
import * as cheerio from 'cheerio';

/**
 * 제목 정제 함수 - 불필요한 텍스트 제거하고 공백 정리
 */
export function cleanTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/새로운게시글/g, '')
    .replace(/\s+/g, ' ')  // 연속 공백을 단일 공백으로
    .trim();
}

/**
 * 텍스트에서 JavaScript 코드 패턴 제거
 */
function removeJsPatterns(text: string): string {
  if (!text) return '';

  return text
    // var, let, const 선언문 제거
    .replace(/\b(var|let|const)\s+\w+\s*=\s*[^;]+;?/g, '')
    // function 선언 제거
    .replace(/function\s*\w*\s*\([^)]*\)\s*\{[^}]*\}/g, '')
    // jQuery/$ 호출 제거 (다양한 패턴)
    .replace(/\$\([^)]*\)\s*\.\s*\w+\s*\([^)]*\)\s*;?/g, '')
    .replace(/jQuery\([^)]*\)\s*\.\s*\w+\s*\([^)]*\)\s*;?/g, '')
    .replace(/jQuery\(function\s*\([^)]*\)\s*\{[\s\S]*?\}\s*\)\s*;?/g, '')
    .replace(/jQuery\(\)/g, '')
    .replace(/\$\(\)/g, '')
    // window/console/document 호출 제거 (안전한 패턴)
    .replace(/\bwindow\.open\([^)]*\)\s*;?/g, '')
    .replace(/\bconsole\.log\([^)]*\)\s*;?/g, '')
    .replace(/\bdocument\.write\([^)]*\)\s*;?/g, '')
    // 특정 변수 할당 제거 (changeUrl 등)
    .replace(/\bchangeUrl\s*=\s*[^;]+;?/g, '')
    // 주석 제거
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // ItgJs 등 특정 객체 호출 제거
    .replace(/\w+Js\.\w+\([^)]*\)/g, '')
    // 빈 괄호 제거
    .replace(/\(\s*\)/g, '')
    // 남은 세미콜론과 중괄호, URL 잔재 정리
    .replace(/[{};]/g, ' ')
    .replace(/&amp/g, '&')
    // 여러 공백을 하나로
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * HTML 요소에서 텍스트만 깨끗하게 추출
 * script, style 등 불필요한 태그를 제거한 후 텍스트 반환
 */
export function getCleanText($: cheerio.CheerioAPI, element: any): string {
  if (!element) return '';

  // 원본 수정 방지를 위해 클론 생성
  const $el = $(element).clone();

  // 불필요한 태그 제거
  $el.find('script, style, noscript, iframe, link, meta, style').remove();

  // 텍스트 추출 및 공백 정리
  let text = $el.text()
    .replace(/\s+/g, ' ')
    .trim();

  // JavaScript 패턴 제거
  text = removeJsPatterns(text);

  return text;
}

/**
 * HTML 문자열에서 텍스트만 추출 (cheerio 로드 오버헤드 있음)
 */
export function cleanHtmlText(html: string): string {
  if (!html) return '';
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, link, meta').remove();
  let text = $('body').text().replace(/\s+/g, ' ').trim();
  return removeJsPatterns(text);
}
