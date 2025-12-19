"use server";

import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { OAuth2Client } from "google-auth-library";

// 인증 클라이언트 생성 (타입 에러 방지용 as any 적용)
const getClient = (accessToken: string) => {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  return new BetaAnalyticsDataClient({ authClient: auth } as any);
};

export async function fetchComprehensiveData(
  accessToken: string,
  propertyId: string
) {
  const client = getClient(accessToken);
  // propertyId 안전 처리
  const property = propertyId.includes("properties/")
    ? propertyId
    : `properties/${propertyId}`;

  console.log(`📡 [GA4] 심층 분석 데이터 수집 시작: ${property}`);

  try {
    // 6가지 리포트를 병렬(Promise.all)로 동시에 요청하여 속도 최적화
    const [
      dailyTrend, // 1. [단기] 최근 28일 일별 추이
      monthlyTrend, // 2. [장기] 최근 12개월 월별 성장세
      sources, // 3. [유입] 유입 경로 Top 15
      pages, // 4. [콘텐츠] 인기 페이지 Top 15
      events, // 5. [행동] 핵심 이벤트(클릭, 다운로드 등) Top 15
      tech, // 6. [환경] 기기 및 OS 환경
    ] = await Promise.all([
      // 1. Daily Trend (28 days)
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
        ],
        orderBys: [
          { dimension: { orderType: "ALPHANUMERIC", dimensionName: "date" } },
        ],
      }),

      // 2. Monthly Trend (12 months) - 성장세 분석용
      client.runReport({
        property,
        dateRanges: [{ startDate: "12monthsAgo", endDate: "today" }],
        dimensions: [{ name: "yearMonth" }],
        metrics: [
          { name: "activeUsers" },
          { name: "newUsers" },
          { name: "sessions" },
        ],
        orderBys: [
          {
            dimension: {
              orderType: "ALPHANUMERIC",
              dimensionName: "yearMonth",
            },
          },
        ],
      }),

      // 3. Top Sources
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "engagementRate" },
        ],
        limit: 15,
      }),

      // 4. Top Pages
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "pageTitle" }, { name: "pagePath" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "activeUsers" },
          { name: "averageSessionDuration" },
        ],
        limit: 15,
      }),

      // 5. Top Events (핵심 지표 발굴용)
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: 15,
      }),

      // 6. Tech/Device (UX 환경 분석용)
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "deviceCategory" }, { name: "operatingSystem" }],
        metrics: [{ name: "activeUsers" }],
        limit: 10,
      }),
    ]);

    // AI에게 줄 프롬프트 생성
    const prompt = generateAdvancedPrompt({
      daily: dailyTrend[0],
      monthly: monthlyTrend[0],
      source: sources[0],
      page: pages[0],
      event: events[0],
      tech: tech[0],
    });

    return prompt;
  } catch (error) {
    console.error("🔥 GA Data Fetch Error:", error);
    throw new Error(`데이터 수집 실패: ${JSON.stringify(error)}`);
  }
}

// --- AI 프롬프트 생성기 (데이터 파싱) ---
function generateAdvancedPrompt(data: any) {
  let p = `
당신은 Google Analytics 4(GA4) 데이터 전문 비즈니스 컨설턴트입니다.
아래 제공된 **6가지 차원의 데이터**를 입체적으로 분석하여, 클라이언트의 질문에 답하고 비즈니스 성장을 위한 구체적인 전략을 제시하세요.

---

## [DATA SECTION 1: 장기 성장 추이 (Last 12 Months)]
*목적: 1년 전 대비 성장률(YoY) 및 계절성 파악*
| 연-월 | 활성 사용자 | 신규 사용자 | 세션 수 |
|---|---|---|---|
`;
  data.monthly.rows?.forEach((r: any) => {
    p += `| ${r.dimensionValues[0].value} | ${r.metricValues[0].value} | ${r.metricValues[1].value} | ${r.metricValues[2].value} |\n`;
  });

  p += `
\n## [DATA SECTION 2: 최근 28일 트렌드 (Daily)]
*목적: 요일별 패턴 및 최근 이슈 파악*
| 날짜 | 사용자 | 세션 | 뷰(PV) |
|---|---|---|---|
`;
  data.daily.rows?.forEach((r: any) => {
    p += `| ${r.dimensionValues[0].value} | ${r.metricValues[0].value} | ${r.metricValues[1].value} | ${r.metricValues[2].value} |\n`;
  });

  p += `
\n## [DATA SECTION 3: 사용자 행동/이벤트 (Events)]
*목적: **핵심 지표(North Star Metric)** 발굴 및 전환 행동 분석*
| 이벤트명 | 발생 횟수 | 실행한 사용자 수 |
|---|---|---|
`;
  data.event.rows?.forEach((r: any) => {
    p += `| ${r.dimensionValues[0].value} | ${r.metricValues[0].value} | ${r.metricValues[1].value} |\n`;
  });

  p += `
\n## [DATA SECTION 4: 유입 채널 (Acquisition)]
*목적: 마케팅 채널 효율성 분석 (참여율 포함)*
| 소스 | 매체 | 사용자 | 세션 | 참여율 |
|---|---|---|---|---|
`;
  data.source.rows?.forEach((r: any) => {
    const rate = (parseFloat(r.metricValues[2].value) * 100).toFixed(1);
    p += `| ${r.dimensionValues[0].value} | ${r.dimensionValues[1].value} | ${r.metricValues[0].value} | ${r.metricValues[1].value} | ${rate}% |\n`;
  });

  p += `
\n## [DATA SECTION 5: 콘텐츠 소비 (Pages)]
*목적: 사용자 관심사 및 랜딩 페이지 효율 분석*
| 페이지 제목 | 경로 | 뷰(PV) | 체류시간(초) |
|---|---|---|---|
`;
  data.page.rows?.forEach((r: any) => {
    const duration = parseFloat(r.metricValues[2].value).toFixed(0);
    p += `| ${r.dimensionValues[0].value} | ${r.dimensionValues[1].value} | ${r.metricValues[0].value} | ${duration}s |\n`;
  });

  p += `
\n## [DATA SECTION 6: 기술 환경 (Tech)]
*목적: 모바일/PC 최적화 여부 판단*
| 기기 | OS | 사용자 수 |
|---|---|---|
`;
  data.tech.rows?.forEach((r: any) => {
    p += `| ${r.dimensionValues[0].value} | ${r.dimensionValues[1].value} | ${r.metricValues[0].value} |\n`;
  });

  p += `
---
## 💡 분석 요청 사항 (Analysis Guideline)
우리 회사 문제점이 뭐고, 앞으로 뭘 더 해야 잘 될까?
`;

  return p;
}
