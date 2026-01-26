
import type { Browser } from 'puppeteer';
import { extractTargetFromImage } from '../llm/extract-target';

/**
 * Puppeteer를 사용하여 단일 페이지 처리 (스크린샷 -> Vision AI)
 */
export async function processBizinfoPage(browser: Browser, url: string, id: string) {
  let page = null;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 2000 });

    // 페이지 이동 (재시도 로직 추가)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        break; // 성공하면 탈출
      } catch (e) {
        console.warn(`[Puppeteer] Navigation attempt ${attempt + 1} failed: ${e}`);
        if (attempt === 2) throw e; // 마지막 시도 실패면 에러 던짐
        await new Promise(r => setTimeout(r, 5000)); // 5초 대기 후 재시도
      }
    }

    // 기본 컨텐츠 대기
    try {
      await page.waitForSelector('.view_cont', { timeout: 10000 });
    } catch {
      console.warn(`[Puppeteer] .view_cont not found for ${id}`);
    }

    // 1. Frame URL 검색으로 뷰어 찾기 (동적 대기)
    let viewerFrame = null;
    const maxWaitTime = 40000; // 사이트가 느리므로 40초 대기
    const checkInterval = 500; // 0.5초마다 체크
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const frames = page.frames();
      console.log(`[Puppeteer] frames found: ${frames.length}. URLs: ${frames.map(f => f.url().substring(0, 50)).join(', ')}`);
      viewerFrame = frames.find(f =>
        f.url().includes('dxviewer') ||
        f.url().includes('synap') ||
        f.url().includes('pdf') ||
        f.url().includes('docviewer') ||
        f.url().includes('Viewer')
      );
      if (viewerFrame) break;
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    // 스크린샷 저장용 배열
    const screenshots: string[] = [];
    let screenshotBuffer: string | Buffer = ''; // Legacy support if needed, but we use screenshots array now

    if (viewerFrame) {
      console.log(`[Puppeteer] Viewer frame found for ${id}: ${viewerFrame.url()}`);

      try {
        // 뷰어 내부 body 대기
        await viewerFrame.waitForSelector('body', { timeout: 30000 });

        // 뷰어 내 이미지/콘텐츠 로딩 완료 대기
        try {
          await viewerFrame.waitForFunction(() => {
            // 이미지가 모두 로딩되었는지 확인
            const images = document.querySelectorAll('img');
            const allImagesLoaded = Array.from(images).every(img => img.complete && img.naturalHeight > 0);
            // 또는 특정 콘텐츠 요소가 존재하는지 확인
            const hasContent = document.body.innerText.length > 100;
            return allImagesLoaded && hasContent;
          }, { timeout: 20000 });
        } catch {
          // 타임아웃되어도 진행 (일부 콘텐츠라도 캡처)
          console.warn(`[Puppeteer] Content loading timeout for ${id}, proceeding anyway`);
        }

        // 뷰어 높이 계산 (스크롤 트리거 후 안정화 대기)
        await viewerFrame.evaluate(() => window.scrollTo(0, 500));
        let finalHeight = 2000;
        for (let i = 0; i < 5; i++) {
          const currentHeight = await viewerFrame.evaluate(() => {
            let maxH = document.body.scrollHeight;
            const allElements = document.querySelectorAll('*');
            for (const el of Array.from(allElements)) {
              if (el.scrollHeight > maxH) maxH = el.scrollHeight;
            }
            return maxH;
          });

          if (currentHeight > finalHeight) {
            finalHeight = currentHeight;
            console.log(`[Puppeteer] Detected height growth: ${finalHeight}`);
            await viewerFrame.evaluate((h) => window.scrollTo(0, h), finalHeight);
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else if (currentHeight > 1000) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        finalHeight = Math.min(Math.max(finalHeight, 2000), 20000);
        const bodyWidth = await viewerFrame.evaluate(() => document.body.scrollWidth);

        console.log(`[Puppeteer] Final stabilized viewer size: ${bodyWidth}x${finalHeight}`);

        // 강제 스크롤 다운 (이미지 Lazy Loading 해제)
        console.log('[Puppeteer] Forcing scroll to load images...');
        for (let y = 0; y <= finalHeight; y += 1000) {
          await viewerFrame.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
          await new Promise(r => setTimeout(r, 200));
        }
        await viewerFrame.evaluate(() => window.scrollTo(0, 0)); // 다시 위로
        await new Promise(r => setTimeout(r, 1000));

        // Page Viewport 조정 (전체 렌더링을 위해)
        await page.setViewport({ width: Math.max(1280, bodyWidth), height: finalHeight + 200 });

        // Frame element 스크린샷 (분할 캡처)
        const bodyEl = await viewerFrame.$('body');

        if (bodyEl) {
          const CHUNK_HEIGHT = 3000;
          const MAX_CHUNKS = 6; // 다시 6장(18000px)으로 증가
          let capturedHeight = 0;

          while (capturedHeight < finalHeight) {
            // 안전장치: 너무 많은 청크 생성 방지
            if (screenshots.length >= MAX_CHUNKS) {
              console.warn(`[Puppeteer] Max chunks (${MAX_CHUNKS}) reached for ${id}, stopping capture`);
              break;
            }

            const height = Math.min(CHUNK_HEIGHT, finalHeight - capturedHeight);

            // 캡처할 위치로 스크롤 이동 및 렌더링 대기 (Virtual Rendering 대응)
            console.log(`[Puppeteer] Scrolling to ${capturedHeight} and waiting for render...`);
            await viewerFrame.evaluate((y) => window.scrollTo(0, y), capturedHeight);
            await new Promise(r => setTimeout(r, 1000)); // 1초 대기

            // 현재 Viewport(또는 Body) 캡처
            // 주의: body.screenshot은 전체를 찍으려 하므로, 클립을 잘 써야 함.
            // 하지만 스크롤을 내렸으니 clip.y도 조정? 
            // Puppeteer screenshot clip is relative to the element top-left (usually (0,0) of body).
            // When we scroll window, body stays at (0,0) relative to document?
            // Actually, for virtual rendering, we want to capture the *viewport*.
            // But screenshotting 'body' with clip might be tricky if body height is huge.

            // 대안: page.screenshot으로 현재 뷰포트만 찍기 (가장 확실)
            // iframe 위치 등 고려해야 하므로, 그냥 body screenshot을 시도하되
            // 스크롤이 되어 있으니 해당 부분이 렌더링 되어 있을 것임.

            const buffer = await bodyEl.screenshot({
              encoding: 'base64',
              type: 'jpeg',
              quality: 50,
              clip: {
                x: 0,
                y: capturedHeight, // 스크롤된 위치에 해당하는 좌표
                width: 1280,
                height: height
              }
            });

            screenshots.push(buffer as string);
            capturedHeight += height;
          }
          console.log(`[Puppeteer] Captured ${screenshots.length} chunks for ${id}`);
        }
      } catch (e) {
        console.error(`[Puppeteer] Frame screenshot failed for ${id}:`, e);
      }
    }

    // 2. Fallback: Main Content
    if (!viewerFrame && !screenshotBuffer) {
      console.log(`[Puppeteer] Fallback to .view_cont screenshot for ${id}`);
      // ... (fallback은 단일 이미지 유지 또는 필요 시 분할)
      // Fallback 로직도 screenshots 배열을 채우도록 수정 필요하지만 
      // 일단 viewerFrame이 없는 경우는 드물므로 기존 로직 유지하되 screenshots 배열에 넣음
      const contentElement = await page.$('.view_cont') || await page.$('body');

      if (contentElement) {
        // ... (기존 viewport 조정)
        try {
          const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
          await page.setViewport({ width: 1920, height: bodyHeight + 100 });
        } catch { }

        const buffer = await contentElement.screenshot({
          encoding: 'base64',
          type: 'jpeg',
          quality: 80,
        });
        screenshots.push(buffer as string);
      }
    }

    if (screenshots.length === 0) {
      throw new Error('Screenshot failed');
    }

    // Vision API 호출
    console.log(`[Puppeteer] Sending ${screenshots.length} screenshots to Gemini Vision (${id})...`);
    const applicationTarget = await extractTargetFromImage(screenshots, 'image/jpeg');

    return applicationTarget;

  } catch (error) {
    console.error(`[Puppeteer] Error processing ${id}:`, error);
    return null;
  } finally {
    if (page) await page.close();
  }
}
