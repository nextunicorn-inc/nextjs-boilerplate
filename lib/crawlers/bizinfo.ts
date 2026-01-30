import * as cheerio from 'cheerio';
import { SupportProgramData, CrawlResult, CrawlOptions } from './types';
import prisma from '../prisma';
import { getCleanText } from './utils';
import type { Browser } from 'puppeteer';
import puppeteer from 'puppeteer';
import { processBizinfoPage } from './bizinfo-pup';
import { extractApplicationTarget, inferSupportField } from '../llm/extract-target';

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

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (e) {
      lastError = e;
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw lastError;
}

/**
 * 날짜 문자열 파싱 (YYYY-MM-DD, YYYY.MM.DD 등)
 */
/**
 * 날짜 문자열 파싱 (YYYY-MM-DD, YYYY.MM.DD 등)
 * isEnd: true면 23:59:59, false면 00:00:00으로 설정
 */
function parseDate(dateStr: string, isEnd: boolean = false): Date | undefined {
  if (!dateStr) return undefined;

  // YYYY-MM-DD 또는 YYYY.MM.DD 형식
  const match = dateStr.match(/(\d{4})[-./](\d{2})[-./](\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);

    if (isEnd) {
      return new Date(year, month, day, 23, 59, 59);
    } else {
      return new Date(year, month, day, 0, 0, 0);
    }
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
        const applicationStart = parseDate(periodMatch[1], false);
        const applicationEnd = parseDate(periodMatch[2], true);

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

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (e) {
      lastError = e;
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw lastError;
}

/**
 * 상세 페이지 파싱 결과 타입
 */
interface DetailPageData {
  title?: string;
  description?: string;
  eligibility?: string;
  organization?: string;
  applicationStart?: Date;
  applicationEnd?: Date;
  targetRegion?: string;
  supportField?: string;
  fundingAmount?: string;
}

/**
 * 상세 페이지 파싱
 */
function parseDetailPage(html: string): DetailPageData {
  const $ = cheerio.load(html);

  const result: DetailPageData = {};

  console.log('[bizinfo] parseDetailPage called, HTML length:', html.length);

  // 제목 추출
  let title = $('.view_title').text().trim() || $('h1').text().trim() || $('.title').text().trim();
  if (title) {
    // "지원사업 공고" 접두어 및 "QR코드..." 접미어 제거
    title = title
      .replace(/^지원사업\s*공고\s*/, '')
      .replace(/QR코드기업마당\s*앱\s*다운로드.*$/i, '')
      .trim();
    result.title = title;
  }

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
        const start = parseDate(periodMatch[1], false);
        const end = parseDate(periodMatch[2], true);
        if (start) result.applicationStart = start;
        if (end) result.applicationEnd = end;
      }
    } else if (headerText.includes('지역') || headerText === '지역') {
      result.targetRegion = value;
    } else if (headerText.includes('분야') || headerText.includes('지원분야')) {
      result.supportField = value;
    } else if (headerText.includes('지원규모') || headerText.includes('지원금액') || headerText.includes('지원한도')) {
      result.fundingAmount = value;
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
          const start = parseDate(periodMatch[1], false);
          const end = parseDate(periodMatch[2], true);
          if (start) result.applicationStart = start;
          if (end) result.applicationEnd = end;
        }
      } else if (headerText.includes('지역') || headerText === '지역') {
        result.targetRegion = value;
      } else if (headerText.includes('분야') || headerText.includes('지원분야')) {
        result.supportField = value;
      } else if (headerText.includes('지원규모') || headerText.includes('지원금액') || headerText.includes('지원한도')) {
        result.fundingAmount = value;
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

  // 방법 3: 카테고리 태그에서 supportField 추출 (fallback)
  if (!result.supportField) {
    // Bizinfo는 제목 위에 .tag 클래스로 카테고리를 표시함 (예: "경영", "기술", "자금")
    const tagEl = $('.tag, .category, span.cate, .view_cate').first();
    if (tagEl.length) {
      const tagText = getCleanText($, tagEl).trim();
      if (tagText) {
        // 매핑: Bizinfo 카테고리를 표준 지원분야로 변환
        const categoryMap: Record<string, string> = {
          '경영': '자금',
          '기술': '기술개발',
          '인력': '인력',
          '수출': '수출',
          '창업': '창업',
          '금융': '자금',
          '내수': '판로',
          '기타': '기타',
        };
        result.supportField = categoryMap[tagText] || tagText;
      }
    }
  }

  // 방법 4: 사업개요 텍스트에서 금액 패턴 추출 (fallback)
  if (!result.fundingAmount && result.description) {
    // 패턴 예: "최대 1억원", "5천만원 이내", "500원/kg", "업체당 2백만원"
    const fundingPatterns = [
      // 기존 패턴
      /최대\s*(\d+(?:,\d+)*\s*(?:억|천만|백만|만)?원)/,
      /(\d+(?:,\d+)*\s*(?:억|천만|백만|만)?원)\s*(?:이내|이하|한도)/,
      /지원금액[:\s]*(\d+(?:,\d+)*\s*(?:억|천만|백만|만)?원)/,
      /(\d+(?:,\d+)*원\/kg)/,
      // 한글 숫자 패턴 (2백만원, 5천만원 등)
      /(\d+백만원)/,
      /(\d+천만원)/,
      /(\d+억원)/,
      // "업체당/1사당/개사당/기업당 OO원" 패턴
      /(?:업체당|개사당|1사당|기업당|업체별)\s*(\d+(?:백|천)?만?원)/,
      // 장려금/보조금/지원금 + 금액 패턴
      /(?:장려금|보조금|지원금|사업비)[:\s]*(\d+(?:백|천)?만?원)/,
      // 일반 금액 패턴 (숫자+단위+원)
      /(\d+(?:,\d+)*(?:억|천만|백만|만|천|백)원)/,
    ];
    for (const pattern of fundingPatterns) {
      const match = result.description.match(pattern);
      if (match) {
        result.fundingAmount = match[1] || match[0];
        break;
      }
    }
  }

  // 방법 5: 키워드 기반 supportField 추론 (fallback) - K-Startup과 동일
  if (!result.supportField && result.description) {
    const inferred = inferSupportField(result.description + ' ' + (result.eligibility || ''));
    if (inferred) {
      result.supportField = inferred;
    }
  }

  console.log('[bizinfo] parseDetailPage result:', {
    hasDescription: !!result.description,
    descriptionLength: result.description?.length,
    hasEligibility: !!result.eligibility,
    organization: result.organization,
    supportField: result.supportField,
    fundingAmount: result.fundingAmount,
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
export async function crawlBizinfo(options: CrawlOptions = {}, browser?: Browser): Promise<CrawlResult> {
  const { maxPages = 3, fetchDetails = true, usePuppeteer = false, targetId, limit } = options;
  const errors: string[] = [];
  let successCount = 0;
  let totalProcessed = 0;

  let localBrowser: Browser | undefined;
  const activeBrowser = browser;

  try {
    if (usePuppeteer && !activeBrowser) {
      console.log('[bizinfo] Launching Puppeteer...');
      localBrowser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
      });
    }

    const workingBrowser = activeBrowser || localBrowser;

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
            let detailData: DetailPageData = {};

            // 상세 페이지 크롤링 (옵션)
            if (fetchDetails) {
              await delay(REQUEST_DELAY);
              const detailHtml = await fetchDetailPage(item.sourceId);
              detailData = parseDetailPage(detailHtml);

              // 0. 키워드 기반 supportField 추론 (LLM 호출 전 빠른 판단)
              const keywordSupportField = inferSupportField(
                ((detailData as any).description || '') + ' ' + ((detailData as any).eligibility || '')
              );
              if (keywordSupportField) {
                (detailData as any).supportField = keywordSupportField;
                console.log(`[bizinfo] Keyword inferred supportField: ${keywordSupportField} for ${item.sourceId}`);
              }

              // 1. 텍스트 기반 LLM 분석 (우선 시도)
              try {
                const textTarget = await extractApplicationTarget(
                  (detailData as any).eligibility || '',
                  (detailData as any).description || ''
                );
                if (textTarget) {
                  (detailData as any).companyAge = textTarget.companyAge;
                  (detailData as any).targetRegion = textTarget.targetRegion;
                  (detailData as any).targetAge = textTarget.targetAge;
                  (detailData as any).targetIndustry = textTarget.targetIndustry;
                  // LLM supportField는 키워드 추론 실패 시에만 사용
                  if (!(detailData as any).supportField && textTarget.supportField) {
                    (detailData as any).supportField = textTarget.supportField;
                    console.log(`[bizinfo] LLM inferred supportField: ${textTarget.supportField} for ${item.sourceId}`);
                  }
                  (detailData as any).llmProcessed = true;
                }
              } catch (llmError) {
                console.error(`[bizinfo] LLM error for ${item.sourceId}:`, llmError);
              }

              // 2. Fallback: Puppeteer Vision AI (필수 데이터 누락 시)
              // 필수 데이터: 업력, 지역 + 모집 기간 (Start/End 중 하나라도 없으면)
              const missingCritical =
                !(detailData as any).companyAge ||
                !(detailData as any).targetRegion ||
                !(detailData as any).applicationStart ||
                !(detailData as any).applicationEnd;

              if (usePuppeteer && workingBrowser && missingCritical) {
                console.log(`[bizinfo] 필수 데이터 누락 (${item.sourceId}), Puppeteer Vision AI 시도...`);
                try {
                  const puppeteerTarget = await processBizinfoPage(workingBrowser, item.url, item.sourceId);
                  if (puppeteerTarget) {
                    // Vision AI 결과가 있으면 덮어쓰거나 채워넣음
                    if (puppeteerTarget.companyAge) (detailData as any).companyAge = puppeteerTarget.companyAge;
                    if (puppeteerTarget.targetRegion) (detailData as any).targetRegion = puppeteerTarget.targetRegion;
                    if (puppeteerTarget.targetAge) (detailData as any).targetAge = puppeteerTarget.targetAge;
                    if (puppeteerTarget.targetIndustry) (detailData as any).targetIndustry = puppeteerTarget.targetIndustry;
                    (detailData as any).llmProcessed = true;
                  }
                } catch (pupError) {
                  console.error(`[bizinfo] Puppeteer error for ${item.sourceId}:`, pupError);
                }
              }
            }

            // DB에 저장 (upsert)
            // item.title이 'Target Debug'인 경우(단일 타겟 크롤링)에만 상세 페이지 제목 사용
            // 그 외(리스트 크롤링)에는 리스트에서 가져온 깔끔한 제목(item.title) 유지
            const finalTitle = (item.title === 'Target Debug' && detailData.title)
              ? detailData.title
              : item.title;

            const programData: SupportProgramData = {
              source: 'bizinfo',
              sourceId: item.sourceId,
              category: item.category,
              title: finalTitle,
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
                companyAge: (detailData as any)?.companyAge || programData.companyAge, // prioritize LLM
                targetRegion: (detailData as any)?.targetRegion || programData.targetRegion, // prioritize LLM
                targetAge: (detailData as any)?.targetAge,
                targetIndustry: (detailData as any)?.targetIndustry,
                supportField: programData.supportField,
                fundingAmount: (detailData as any)?.fundingAmount,

                llmProcessed: (detailData as any)?.llmProcessed || false,
                applicationTarget: null, // Clear old field
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
                targetRegion: (detailData as any)?.targetRegion || programData.targetRegion,
                companyAge: (detailData as any)?.companyAge,
                targetAge: (detailData as any)?.targetAge,
                targetIndustry: (detailData as any)?.targetIndustry,
                supportField: programData.supportField,
                fundingAmount: (detailData as any)?.fundingAmount,

                llmProcessed: (detailData as any)?.llmProcessed || false,
                applicationTarget: null,
              },
            });

            successCount++;
            totalProcessed++;
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
