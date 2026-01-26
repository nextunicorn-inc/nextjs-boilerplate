import * as cheerio from 'cheerio';
import { SupportProgramData, CrawlResult, CrawlOptions } from './types';
import prisma from '../prisma';
import { cleanTitle, getCleanText } from './utils';

const BASE_URL = 'https://www.k-startup.go.kr';
const LIST_URL = `${BASE_URL}/web/contents/bizpbanc-ongoing.do`;

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
  daysRemaining?: number;
  applicationEnd?: Date;
  viewCount?: number;
  url: string;
}

/**
 * 리스트 페이지 HTML 가져오기
 */
async function fetchListPage(page: number = 1): Promise<string> {
  const url = `${LIST_URL}?page=${page}`;
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
 * 리스트 페이지 HTML 파싱
 */
function parseListPage(html: string): ListItem[] {
  const $ = cheerio.load(html);
  const items: ListItem[] = [];

  // 공고 목록은 javascript:go_view(ID) 형태로 링크됨
  $('a[href*="go_view"]').each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href') || '';

    // ID 추출: go_view(176009) -> 176009
    const idMatch = href.match(/go_view\((\d+)\)/);
    if (!idMatch) return;

    const sourceId = idMatch[1];
    const text = $el.text().trim();

    // 카테고리, 제목, D-day, 마감일자, 기관명, 조회수 파싱
    // 텍스트 구조: [카테고리] D-N 마감일자 YYYY-MM-DD 제목 기관명 조회 N

    // D-day 추출
    const dDayMatch = text.match(/D-(\d+)/);
    const daysRemaining = dDayMatch ? parseInt(dDayMatch[1]) : undefined;

    // 마감일자 추출
    const dateMatch = text.match(/마감일자\s*(\d{4}-\d{2}-\d{2})/);
    const applicationEnd = dateMatch ? new Date(dateMatch[1]) : undefined;

    // 조회수 추출
    const viewMatch = text.match(/조회\s*([\d,]+)/);
    const viewCount = viewMatch ? parseInt(viewMatch[1].replace(/,/g, '')) : undefined;

    // 카테고리 추출 (처음 나오는 한글 단어)
    const categories = ['글로벌', '사업화', '시설ㆍ공간ㆍ보육', '행사ㆍ네트워크', '인력', 'R&D', '멘토링ㆍ컨설팅', '정책', '판로ㆍ해외진출'];
    let category = '';
    for (const cat of categories) {
      if (text.includes(cat)) {
        category = cat;
        break;
      }
    }

    // 제목 추출 Improved Logic
    let title = '';

    // 1. 마감일자 패턴 찾기
    const datePattern = /마감일자\s*\d{4}-\d{2}-\d{2}/;
    const titleDateMatch = text.match(datePattern);

    if (titleDateMatch && titleDateMatch.index !== undefined) {
      // 마감일자 다음부터 텍스트 시작
      let content = text.substring(titleDateMatch.index + titleDateMatch[0].length).trim();

      // 2. '조회' 패턴 찾아서 뒷부분 자르기
      const viewIndex = content.lastIndexOf('조회');
      if (viewIndex > 0) {
        content = content.substring(0, viewIndex).trim();
      }

      // 3. 기관명 제거 시도
      // 기관명은 보통 끝부분에 위치함. 하지만 정규식으로 정확히 잡기 어려울 수 있음.
      // 알려진 기관명 접미사로 끝나는지 확인
      const orgSuffixes = ['창업진흥원', '중소벤처기업부', '센터', '재단', '공단', '진흥원', '협회', '대학교', '산학협력단', '원', '연구원'];

      // content가 "제목 기관명" 형태일 것이라 가정.
      // 기관명 정규식 재시도
      const orgMatch = content.match(/([가-힣]+(?:센터|재단|공단|진흥원|협회|대학교[가-힣]*|산학협력단|연구원))$/);
      if (orgMatch) {
        // 정규식으로 잡힌 경우
        // 하지만 제목에 센터가 들어갈 수도 있음 (예: 데이터센터 입주기업 모집)
        // K-startup은 보통 제목과 기관명이 공백으로 구분됨.
        // 마땅한 구분자가 없으므로, 최대한 보수적으로 기관명 제거하거나,
        // 기존 정규식 logic을 fallback으로 사용하지 않고 이 logic을 main으로 하되, 
        // 기관명 분리가 확실하지 않으면 title에 포함되어도 "사업화 D-1..." 보다는 나음.

        // 일단 기관명 추출 로직 (list scope)과는 별개로 title 정제
        const possibleOrg = orgMatch[0];
        // 제목이 기관명으로 끝나면 제거 (단, 제목이 너무 짧아지면 의심)
        if (content.endsWith(possibleOrg) && content.length > possibleOrg.length + 2) {
          title = content.substring(0, content.length - possibleOrg.length).trim();
        } else {
          title = content;
        }
      } else {
        // 기관명 패턴이 없으면 전체를 제목으로
        title = content;
      }
    }

    // 기존 regex 방식이 더 깔끔할 수 있으니, 만약 위 로직에서 나온 title이 너무 길거나 이상하면
    // 또는 그냥 위 로직이 "사업화 ..." 같은 garbage가 들어가는 것을 방지하므로 이대로 사용.

    // Clean remaining junk
    title = cleanTitle(title);

    // Fallback if title is empty (should not happen with match)
    if (!title && text.length > 20) {
      // 정말 못 찾았을 때만 substring
      // 하지만 "마감일자"도 못 찾은 경우일 것임.
      // 그냥 raw text 사용하되 length limit만 둠?
      // 아니면 빈 문자열?
      // 기존 로직: cleanTitle(title || text.substring(0, 100));
      // "사업화 D-1 마감일자" 가 제목이 되는 건 text.substring(0, 100) 때문이었음.
      // 마감일자가 있는 경우엔 무조건 위 로직을 타므로 괜찮음.
    }

    // 기관명 추출
    const orgMatch = text.match(/(창업진흥원|중소벤처기업부|[가-힣]+(?:센터|재단|공단|진흥원|협회|대학교[가-힣]*|산학협력단))/);
    const organization = orgMatch ? orgMatch[1] : undefined;

    if (sourceId && (title || text.length > 20)) {
      // 제목 정제 적용
      const cleanedTitle = cleanTitle(title || text.substring(0, 100));
      items.push({
        sourceId,
        category: category || '기타',
        title: cleanedTitle,
        organization,
        daysRemaining,
        applicationEnd,
        viewCount,
        url: `${LIST_URL}?schM=view&pbancSn=${sourceId}`,
      });
    }
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
async function fetchDetailPage(pbancSn: string): Promise<string> {
  const url = `${LIST_URL}?schM=view&pbancSn=${pbancSn}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch detail page ${pbancSn}: ${response.status}`);
  }

  return response.text();
}

/**
 * 상세 페이지 파싱 결과 타입
 */
interface DetailPageData {
  title?: string;
  description?: string;
  eligibility?: string;
  region?: string;
  targetAge?: string;
  targetRegion?: string;
  targetType?: string;
  companyAge?: string;
  supportField?: string;
  institutionType?: string;
  applicationStart?: Date;
  applicationEnd?: Date;
  organization?: string;
}

/**
 * 상세 페이지 파싱
 */
function parseDetailPage(html: string): DetailPageData {
  const $ = cheerio.load(html);

  const result: DetailPageData = {};

  // 제목 추출 - 페이지 상단 헤더에서 (#scrTitle h3가 가장 정확함)
  const titleEl = $('#scrTitle h3, .title h3').first();
  if (titleEl.length) {
    result.title = cleanTitle(titleEl.text());
  } else {
    // fallback
    const fallbackTitle = $('h1.view_tit, .view_title, .cont_tit').first();
    if (fallbackTitle.length) {
      result.title = cleanTitle(fallbackTitle.text());
    }
  }

  // 주관기관명 추출
  $('li, span').each((_, el) => {
    const text = getCleanText($, el);
    if (text.startsWith('주관기관명')) {
      result.organization = text.replace('주관기관명', '').trim();
    }
  });

  // 요약 테이블에서 정형 데이터 추출
  // k-startup 상세 페이지는 "지원분야", "대상연령", "지역", "대상", "창업업력" 등의 라벨을 사용
  $('li, div.info_item, span, dt, th').each((_, el) => {
    const text = getCleanText($, el); // getCleanText 사용

    // "라벨값" 패턴 매칭
    if (text.startsWith('지원분야')) {
      result.supportField = text.replace('지원분야', '').trim();
    } else if (text.startsWith('대상연령')) {
      result.targetAge = text.replace('대상연령', '').trim();
    } else if (text.startsWith('지역') && !text.includes('지역구분')) {
      result.targetRegion = text.replace('지역', '').trim();
    } else if (text.startsWith('대상') && !text.includes('대상연령')) {
      result.targetType = text.replace('대상', '').trim();
    } else if (text.startsWith('창업업력')) {
      result.companyAge = text.replace('창업업력', '').trim();
    } else if (text.startsWith('기관구분')) {
      result.institutionType = text.replace('기관구분', '').trim();
    } else if (text.startsWith('주관기관명')) {
      // 주관기관은 별도 필드로 처리 (조직명)
    } else if (text.startsWith('접수기간')) {
      // 접수기간 파싱: "2026-01-06 ~ 2026-01-27 16:00" 형태
      const periodStr = text.replace('접수기간', '').trim();
      const dateMatch = periodStr.match(/(\d{4}-\d{2}-\d{2}).*?[~\-].*?(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        result.applicationStart = new Date(dateMatch[1]);
        result.applicationEnd = new Date(dateMatch[2]);
      }
    }
  });

  // 대안: 테이블 형식에서 추출 (th/td 쌍)
  $('table tr, dl').each((_, row) => {
    const $row = $(row);
    const $header = $row.find('th, dt').first();
    const $value = $row.find('td, dd').first();

    const header = getCleanText($, $header);
    const value = getCleanText($, $value);

    if (!header || !value) return;

    if (header.includes('지원분야') && !result.supportField) {
      result.supportField = value;
    } else if (header.includes('대상연령') && !result.targetAge) {
      result.targetAge = value;
    } else if (header === '지역' && !result.targetRegion) {
      result.targetRegion = value;
    } else if (header === '대상' && !result.targetType) {
      result.targetType = value;
    } else if (header.includes('창업업력') && !result.companyAge) {
      result.companyAge = value;
    } else if (header.includes('기관구분') && !result.institutionType) {
      result.institutionType = value;
    }
  });

  // 지원 대상/자격 요건 추출 (텍스트)
  const eligibilityKeywords = ['지원대상', '신청자격', '지원자격', '참여자격', '모집대상', '신청대상'];
  $('th, dt, strong, b, h3, h4').each((_, el) => {
    const headerText = getCleanText($, el);
    if (eligibilityKeywords.some(kw => headerText.includes(kw))) {
      // 다음 요소나 부모의 td에서 내용 추출
      let content = '';
      const nextEl = $(el).next();
      if (nextEl.length) {
        content = getCleanText($, nextEl);
      } else {
        const parentRow = $(el).closest('tr, dl, div');
        if (parentRow.length) {
          content = getCleanText($, parentRow.find('td, dd, p'));
        }
      }
      if (content && (!result.eligibility || content.length > result.eligibility.length)) {
        result.eligibility = content;
      }
    }
  });

  // 사업 개요/설명 추출 (Cleaned Text)

  // 1. information_list-wrap 구조 파싱 (우선순위 높음)
  const infoListWrap = $('.information_list-wrap, .view_editor');
  if (infoListWrap.length) {
    let desc = '';

    // .information_list 순회
    infoListWrap.find('.information_list').each((_, el) => {
      const $el = $(el);
      const title = getCleanText($, $el.find('p.title'));

      if (title) desc += `\n### ${title}\n`;

      // 리스트 아이템 처리
      const listItems = $el.find('li.dot_list');
      if (listItems.length) {
        listItems.each((_, li) => {
          const $li = $(li);
          const subTitle = getCleanText($, $li.find('.tit'));
          const text = getCleanText($, $li.find('.txt'));

          if (subTitle) desc += `- **${subTitle}**: ${text}\n`;
          else desc += `- ${text || getCleanText($, li)}\n`;
        });
      } else {
        // 일반 텍스트 (.txt 또는 전체 텍스트)
        const txt = getCleanText($, $el.find('.txt')) || getCleanText($, $el);
        // title과 겹치지 않게 처리
        const cleanTxt = txt.replace(title, '').trim();
        if (cleanTxt) desc += `${cleanTxt}\n`;
      }
    });

    // view_editor direct content
    if (!desc && infoListWrap.hasClass('view_editor')) {
      desc = getCleanText($, infoListWrap);
    }

    if (desc.trim().length > 20) {
      result.description = desc;
    }
  }

  // 2. 기존 방식 (Fallback)
  if (!result.description) {
    $('div.cont_box, div.view_cont, div.content, section').each((_, el) => {
      // 이미 찾은 경우 스킵
      if (result.description) return;

      const text = getCleanText($, el);
      // Ignore short texts that might be just nav or small containers
      if (text.length > 50) {
        result.description = text;
      }
    });
  }

  // 길이 제한
  if (result.description) result.description = result.description.substring(0, 5000);
  if (result.eligibility) result.eligibility = result.eligibility.substring(0, 2000);
  if (result.title) result.title = result.title.substring(0, 500);

  return result;
}

/**
 * 전체 페이지 수 확인
 */
function getTotalPages(html: string): number {
  const $ = cheerio.load(html);

  // 페이지네이션에서 마지막 페이지 번호 찾기
  let maxPage = 1;
  $('a[href*="fn_pageMove"], .pagination a, .paging a').each((_, el) => {
    const text = $(el).text().trim();
    const pageNum = parseInt(text);
    if (!isNaN(pageNum) && pageNum > maxPage) {
      maxPage = pageNum;
    }
  });

  return Math.min(maxPage, 10); // 최대 10페이지로 제한
}

/**
 * k-startup 전체 크롤링
 */
export async function crawlKStartup(options: CrawlOptions = {}): Promise<CrawlResult> {
  const { maxPages = 3, fetchDetails = true, limit } = options;
  const errors: string[] = [];
  let successCount = 0;
  let totalProcessed = 0;

  try {
    console.log('[k-startup] 크롤링 시작...');

    // 첫 페이지 가져와서 전체 페이지 수 확인
    const firstPageHtml = await fetchListPage(1);
    const totalPages = Math.min(getTotalPages(firstPageHtml), maxPages);

    console.log(`[k-startup] 총 ${totalPages}페이지 크롤링 예정`);

    // 페이지별 크롤링
    for (let page = 1; page <= totalPages; page++) {
      try {
        console.log(`[k-startup] 페이지 ${page}/${totalPages} 크롤링 중...`);

        const html = page === 1 ? firstPageHtml : await fetchListPage(page);
        const items = parseListPage(html);

        console.log(`[k-startup] 페이지 ${page}에서 ${items.length}개 공고 발견`);

        for (const item of items) {
          if (limit && totalProcessed >= limit) break;

          try {
            let detailData = {};

            // 상세 페이지 크롤링 (옵션)
            if (fetchDetails) {
              await delay(REQUEST_DELAY);
              const detailHtml = await fetchDetailPage(item.sourceId);
              detailData = parseDetailPage(detailHtml);
            }

            // DB에 저장 (upsert)
            const programData: SupportProgramData = {
              source: 'k-startup',
              sourceId: item.sourceId,
              category: item.category,
              title: item.title,
              organization: item.organization,
              applicationEnd: item.applicationEnd,
              url: item.url,
              viewCount: item.viewCount,
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
                applicationEnd: programData.applicationEnd,
                url: programData.url,
                viewCount: programData.viewCount,
                description: programData.description,
                eligibility: programData.eligibility,
                region: programData.region,
                targetAge: programData.targetAge,
                targetRegion: programData.targetRegion,
                targetType: programData.targetType,
                companyAge: programData.companyAge,
                supportField: programData.supportField,
                institutionType: programData.institutionType,
                applicationStart: programData.applicationStart,
                updatedAt: new Date(),
              },
              create: {
                source: programData.source,
                sourceId: programData.sourceId,
                category: programData.category,
                title: programData.title,
                organization: programData.organization,
                applicationEnd: programData.applicationEnd,
                url: programData.url,
                viewCount: programData.viewCount,
                description: programData.description,
                eligibility: programData.eligibility,
                region: programData.region,
                targetAge: programData.targetAge,
                targetRegion: programData.targetRegion,
                targetType: programData.targetType,
                companyAge: programData.companyAge,
                supportField: programData.supportField,
                institutionType: programData.institutionType,
                applicationStart: programData.applicationStart,
              },
            });

            successCount++;
            totalProcessed++;
          } catch (itemError) {
            const errorMsg = `공고 ${item.sourceId} 처리 실패: ${itemError}`;
            console.error(`[k-startup] ${errorMsg}`);
            errors.push(errorMsg);
          }
        }

        // 페이지 간 딜레이
        if (page < totalPages) {
          await delay(REQUEST_DELAY);
        }
      } catch (pageError) {
        const errorMsg = `페이지 ${page} 크롤링 실패: ${pageError}`;
        console.error(`[k-startup] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`[k-startup] 크롤링 완료: ${successCount}개 처리`);

    return {
      success: errors.length === 0,
      count: successCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('[k-startup] 크롤링 실패:', error);
    return {
      success: false,
      count: successCount,
      errors: [`크롤링 실패: ${error}`],
    };
  }
}
