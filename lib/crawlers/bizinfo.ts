import * as cheerio from 'cheerio';
import { SupportProgramData, CrawlResult, CrawlOptions } from './types';
import prisma from '../prisma';
import { getCleanText } from './utils';
import puppeteer from 'puppeteer';
import { processBizinfoPage } from './bizinfo-pup';
import { extractApplicationTarget } from '../llm/extract-target';

const BASE_URL = 'https://www.bizinfo.go.kr';
const LIST_URL = `${BASE_URL}/web/lay1/bbs/S1T122C128/AS/74/list.do`;
const VIEW_URL = `${BASE_URL}/web/lay1/bbs/S1T122C128/AS/74/view.do`;

// 요청 간 딜레이 (ms)
const REQUEST_DELAY = 1500;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface ListItem {
  sourceId: string;
  category: string;
  title: string;
  organization?: string;
  region?: string;
  applicationStart?: Date;
  applicationEnd?: Date;
  url: string;
}

/**
 * 리스트 페이지 HTML 가져오기
 */
async function fetchListPage(page: number = 1, rows: number = 15): Promise<string> {
  const url = `${LIST_URL}?rows=${rows}&cpage=${page}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch list page ${page}: ${response.status}`);
  }

  return response.text();
}

/**
 * 날짜 문자열 파싱 (YYYY-MM-DD, YYYY.MM.DD 등)
 */
function parseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;

  // YYYY-MM-DD 또는 YYYY.MM.DD 형식
  const match = dateStr.match(/(\d{4})[-./](\d{2})[-./](\d{2})/);
  if (match) {
    return new Date(`${match[1]}-${match[2]}-${match[3]}`);
  }

  return undefined;
}

/**
 * 리스트 페이지 HTML 파싱
 */
function parseListPage(html: string): ListItem[] {
  const $ = cheerio.load(html);
  const items: ListItem[] = [];

  // 공고 목록 링크 찾기 (pblancId 파라미터가 있는 링크)
  $('a[href*="pblancId=PBLN"]').each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href') || '';

    // pblancId 추출
    const idMatch = href.match(/pblancId=(PBLN_\d+)/);
    if (!idMatch) return;

    const sourceId = idMatch[1];
    const title = $el.text().trim();

    // 빈 제목 무시
    if (!title || title.length < 5) return;

    // 지역 추출 (제목에서 [지역] 형식)
    let region = '';
    const regionMatch = title.match(/\[([가-힣]+)\]/);
    if (regionMatch) {
      region = regionMatch[1];
    }

    // 카테고리 추출 (같은 행에서)
    let category = '기타';
    const $row = $el.closest('tr, li, div.list-item');
    if ($row.length) {
      const rowText = $row.text();
      const categories = ['금융', '기술', '인력', '수출', '내수', '창업', '경영', '기타'];
      for (const cat of categories) {
        if (rowText.includes(cat)) {
          category = cat;
          break;
        }
      }

      // 접수기간 추출
      const periodMatch = rowText.match(/(\d{4}[-./]\d{2}[-./]\d{2})\s*[~-]\s*(\d{4}[-./]\d{2}[-./]\d{2})/);
      if (periodMatch) {
        const applicationStart = parseDate(periodMatch[1]);
        const applicationEnd = parseDate(periodMatch[2]);

        items.push({
          sourceId,
          category,
          title: title.replace(/\[[가-힣]+\]\s*/, '').trim(), // 지역 태그 제거
          region,
          applicationStart,
          applicationEnd,
          url: `${VIEW_URL}?pblancId=${sourceId}`,
        });
        return;
      }
    }

    items.push({
      sourceId,
      category,
      title: title.replace(/\[[가-힣]+\]\s*/, '').trim(),
      region,
      url: `${VIEW_URL}?pblancId=${sourceId}`,
    });
  });

  // 중복 제거
  const uniqueItems = items.filter((item, index, self) =>
    index === self.findIndex(t => t.sourceId === item.sourceId)
  );

  return uniqueItems;
}

/**
 * 상세 페이지 HTML 가져오기
 */
async function fetchDetailPage(pblancId: string): Promise<string> {
  const url = `${VIEW_URL}?pblancId=${pblancId}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch detail page ${pblancId}: ${response.status}`);
  }

  return response.text();
}

/**
 * 상세 페이지 파싱 결과 타입
 */
interface DetailPageData {
  description?: string;
  eligibility?: string;
  organization?: string;
  applicationStart?: Date;
  applicationEnd?: Date;
  targetRegion?: string;
  supportField?: string;
}

/**
 * 상세 페이지 파싱
 */
function parseDetailPage(html: string): DetailPageData {
  const $ = cheerio.load(html);

  const result: DetailPageData = {};

  console.log('[bizinfo] parseDetailPage called, HTML length:', html.length);

  // 방법 1: 기업마당 공통 구조 (span.s_title + 다음 형제 div.txt)
  $('span.s_title').each((_, el) => {
    const $title = $(el);
    const headerText = getCleanText($, $title).trim();

    // 다음 형제 요소에서 div.txt 찾기
    const $nextTxt = $title.next('div.txt');
    if (!$nextTxt.length) return;

    const value = getCleanText($, $nextTxt).trim();
    if (!headerText || !value) return;

    if (headerText.includes('사업개요') || headerText.includes('지원내용')) {
      result.description = value;
    } else if (headerText.includes('지원대상') || headerText.includes('신청자격') || headerText.includes('참여자격')) {
      result.eligibility = value;
    } else if (headerText.includes('사업수행기관') || headerText.includes('수행기관')) {
      result.organization = value;
    } else if (headerText.includes('신청기간') || headerText.includes('접수기간')) {
      const periodMatch = value.match(/(\d{4}[-./]\d{2}[-./]\d{2})\s*[~-]\s*(\d{4}[-./]\d{2}[-./]\d{2})/);
      if (periodMatch) {
        const start = parseDate(periodMatch[1]);
        const end = parseDate(periodMatch[2]);
        if (start) result.applicationStart = start;
        if (end) result.applicationEnd = end;
      }
    } else if (headerText.includes('지역') || headerText === '지역') {
      result.targetRegion = value;
    } else if (headerText.includes('분야') || headerText.includes('지원분야')) {
      result.supportField = value;
    }
  });

  // 방법 2: 테이블 형식 데이터 파싱 (fallback)
  if (!result.description && !result.eligibility) {
    $('th, dt').each((_, el) => {
      const headerText = getCleanText($, el);
      const $td = $(el).next('td, dd');
      const value = getCleanText($, $td);

      if (headerText.includes('사업개요') || headerText.includes('지원내용')) {
        result.description = value;
      } else if (headerText.includes('지원대상') || headerText.includes('신청자격') || headerText.includes('참여자격')) {
        result.eligibility = value;
      } else if (headerText.includes('사업수행기관') || headerText.includes('수행기관')) {
        result.organization = value;
      } else if (headerText.includes('신청기간') || headerText.includes('접수기간')) {
        const periodMatch = value.match(/(\d{4}[-./]\d{2}[-./]\d{2})\s*[~-]\s*(\d{4}[-./]\d{2}[-./]\d{2})/);
        if (periodMatch) {
          const start = parseDate(periodMatch[1]);
          const end = parseDate(periodMatch[2]);
          if (start) result.applicationStart = start;
          if (end) result.applicationEnd = end;
        }
      } else if (headerText.includes('지역') || headerText === '지역') {
        result.targetRegion = value;
      } else if (headerText.includes('분야') || headerText.includes('지원분야')) {
        result.supportField = value;
      }
    });
  }

  // 본문 컨텐츠에서 추가 정보 추출
  if (!result.description) {
    // Try to find the main content area and clean it
    const contentEl = $('div.view_cont, div.content, article').first();
    if (contentEl.length) {
      result.description = getCleanText($, contentEl).substring(0, 5000);
    }
  }

  // 길이 제한
  if (result.description) result.description = result.description.substring(0, 5000);
  if (result.eligibility) result.eligibility = result.eligibility.substring(0, 2000);

  console.log('[bizinfo] parseDetailPage result:', {
    hasDescription: !!result.description,
    descriptionLength: result.description?.length,
    hasEligibility: !!result.eligibility,
    organization: result.organization,
  });

  return result;
}

/**
 * 전체 페이지 수 확인
 */
function getTotalPages(html: string): number {
  const $ = cheerio.load(html);

  // 페이지네이션에서 마지막 페이지 번호 찾기
  let maxPage = 1;
  $('a[href*="cpage="], .pagination a, .paging a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const cpageMatch = href.match(/cpage=(\d+)/);
    if (cpageMatch) {
      const pageNum = parseInt(cpageMatch[1]);
      if (pageNum > maxPage) {
        maxPage = pageNum;
      }
    }

    const text = $(el).text().trim();
    const pageNum = parseInt(text);
    if (!isNaN(pageNum) && pageNum > maxPage) {
      maxPage = pageNum;
    }
  });

  return Math.min(maxPage, 10); // 최대 10페이지로 제한
}

/**
 * 기업마당 전체 크롤링
 */
export async function crawlBizinfo(options: CrawlOptions = {}): Promise<CrawlResult> {
  const { maxPages = 3, fetchDetails = true, usePuppeteer = false, targetId, limit } = options;
  const errors: string[] = [];
  let successCount = 0;
  let totalProcessed = 0;
  let browser = null;

  try {
    if (usePuppeteer) {
      console.log('[bizinfo] Launching Puppeteer...');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
      });
    }

    console.log('[bizinfo] 크롤링 시작...');

    // 첫 페이지 가져와서 전체 페이지 수 확인
    const firstPageHtml = await fetchListPage(1);
    const totalPages = Math.min(getTotalPages(firstPageHtml), maxPages);

    console.log(`[bizinfo] 총 ${totalPages}페이지 크롤링 예정`);

    // 페이지별 크롤링
    const loopMax = targetId ? 1 : totalPages;

    for (let page = 1; page <= loopMax; page++) {
      try {
        let items: any[] = [];

        if (targetId) {
          console.log(`[bizinfo] Target ID 크롤링: ${targetId}`);
          items = [{
            sourceId: targetId,
            url: `${VIEW_URL}?pblancId=${targetId}`,
            title: 'Target Debug',
            category: 'Debug'
          }];
        } else {
          console.log(`[bizinfo] 페이지 ${page}/${totalPages} 크롤링 중...`);
          const html = page === 1 ? firstPageHtml : await fetchListPage(page);
          items = parseListPage(html);
          console.log(`[bizinfo] 페이지 ${page}에서 ${items.length}개 공고 발견`);
        }

        for (const item of items) {
          if (limit && totalProcessed >= limit) break;

          try {
            let detailData = {};

            // 상세 페이지 크롤링 (옵션)
            if (fetchDetails) {
              await delay(REQUEST_DELAY);
              const detailHtml = await fetchDetailPage(item.sourceId);
              detailData = parseDetailPage(detailHtml);

              // LLM Processing: Vision AI (Puppeteer) or Text-based
              if (usePuppeteer && browser) {
                // Vision AI 방식
                try {
                  const puppeteerTarget = await processBizinfoPage(browser, item.url, item.sourceId);
                  if (puppeteerTarget) {
                    (detailData as any).applicationTarget = JSON.stringify(puppeteerTarget);
                    (detailData as any).llmProcessed = true;
                  }
                } catch (pupError) {
                  console.error(`[bizinfo] Puppeteer error for ${item.sourceId}:`, pupError);
                }
              } else {
                // 텍스트 기반 LLM 분석
                try {
                  const textTarget = await extractApplicationTarget(
                    (detailData as any).eligibility || '',
                    (detailData as any).description || ''
                  );
                  if (textTarget) {
                    (detailData as any).applicationTarget = JSON.stringify(textTarget);
                    (detailData as any).llmProcessed = true;
                  }
                } catch (llmError) {
                  console.error(`[bizinfo] LLM error for ${item.sourceId}:`, llmError);
                }
              }
            }

            // DB에 저장 (upsert)
            const programData: SupportProgramData = {
              source: 'bizinfo',
              sourceId: item.sourceId,
              category: item.category,
              title: item.title,
              organization: item.organization,
              region: item.region,
              applicationStart: item.applicationStart,
              applicationEnd: item.applicationEnd,
              url: item.url,
              ...detailData,
            };

            await prisma.supportProgram.upsert({
              where: {
                source_sourceId: {
                  source: programData.source,
                  sourceId: programData.sourceId,
                },
              },
              update: {
                category: programData.category,
                title: programData.title,
                organization: programData.organization,
                region: programData.region,
                applicationStart: programData.applicationStart,
                applicationEnd: programData.applicationEnd,
                url: programData.url,
                description: programData.description,
                eligibility: programData.eligibility,
                targetRegion: programData.targetRegion,
                supportField: programData.supportField,
                applicationTarget: (detailData as any)?.applicationTarget,
                llmProcessed: (detailData as any)?.llmProcessed || false,
                updatedAt: new Date(),
              },
              create: {
                source: programData.source,
                sourceId: programData.sourceId,
                category: programData.category,
                title: programData.title,
                organization: programData.organization,
                region: programData.region,
                applicationStart: programData.applicationStart,
                applicationEnd: programData.applicationEnd,
                url: programData.url,
                description: programData.description,
                eligibility: programData.eligibility,
                targetRegion: programData.targetRegion,
                supportField: programData.supportField,
                applicationTarget: (detailData as any)?.applicationTarget,
                llmProcessed: (detailData as any)?.llmProcessed || false,
              },
            });

            successCount++;
          } catch (itemError) {
            const errorMsg = `공고 ${item.sourceId} 처리 실패: ${itemError}`;
            console.error(`[bizinfo] ${errorMsg}`);
            errors.push(errorMsg);
          }
        }

        // 페이지 간 딜레이
        if (page < totalPages) {
          await delay(REQUEST_DELAY);
        }
      } catch (pageError) {
        const errorMsg = `페이지 ${page} 크롤링 실패: ${pageError}`;
        console.error(`[bizinfo] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`[bizinfo] 크롤링 완료: ${successCount}개 처리`);

    return {
      success: errors.length === 0,
      count: successCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('[bizinfo] 크롤링 실패:', error);
    return {
      success: false,
      count: successCount,
      errors: [`크롤링 실패: ${error}`],
    };
  } finally {
    if (browser) await browser.close();
  }
}
