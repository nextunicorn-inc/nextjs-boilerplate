"use server";

import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { OAuth2Client } from "google-auth-library";

// OAuth Access Token을 받아 클라이언트를 생성하는 헬퍼 함수
const getClient = (accessToken: string) => {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });

  return new BetaAnalyticsDataClient({
    // 핵심 수정 1: 'auth'가 아니라 'authClient'에 넣어야 합니다.
    // 핵심 수정 2: 라이브러리 간 버전 차이로 인한 타입 에러를 막기 위해 'as any'를 붙입니다.
    authClient: auth,
  } as any);
};
export async function fetchComprehensiveData(
  accessToken: string,
  propertyId: string
) {
  const client = getClient(accessToken);
  const property = `properties/${propertyId}`;

  try {
    // 1. [Trend] 최근 28일간의 주요 지표 변화 (방문자, 이탈률, 세션 등)
    const trendReport = await client.runReport({
      property,
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "activeUsers" }, // 활성 사용자
        { name: "sessions" }, // 세션 수
        { name: "screenPageViews" }, // 페이지 뷰
        { name: "engagementRate" }, // 참여율 (이탈률의 반대 개념)
      ],
      orderBys: [
        { dimension: { orderType: "ALPHANUMERIC", dimensionName: "date" } },
      ],
    });

    // 2. [Acquisition] 상위 유입 경로 (어디서 왔는가?)
    const sourceReport = await client.runReport({
      property,
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      limit: 10, // 상위 10개만
    });

    // 3. [Content] 상위 인기 페이지 (무엇을 봤는가?)
    const pageReport = await client.runReport({
      property,
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      dimensions: [{ name: "pageTitle" }, { name: "pagePath" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
      ],
      limit: 10, // 상위 10개만
    });

    // 4. 데이터 가공 및 프롬프트 생성 (AI용 파싱)
    const prompt = generateAIPrompt({
      trend: trendReport[0],
      source: sourceReport[0],
      page: pageReport[0],
    });

    return prompt;
  } catch (error) {
    console.error("GA Data API Error:", error);
    throw new Error("데이터를 가져오는 중 실패했습니다.");
  }
}

// --- AI를 위한 데이터 파싱 함수 (핵심!) ---
function generateAIPrompt(reports: any) {
  let prompt = `
당신은 세계 최고의 데이터 분석가이자 컨설턴트입니다. 
아래 제공되는 Google Analytics 4(GA4) 데이터를 심층 분석하여, 웹사이트 소유자에게 도움이 되는 비즈니스 인사이트를 한국어로 제공해주세요.

## 분석 목표
1. **현황 파악**: 지난 28일간의 트래픽 추세와 특이점 요약
2. **원인 분석**: 사용자가 주로 어디서 유입되었고, 어떤 콘텐츠에 관심을 가졌는지
3. **액션 플랜**: 데이터를 바탕으로 매출(또는 트래픽)을 늘리기 위해 당장 실행해야 할 구체적인 개선안 3가지를 제안

---

## [DATA SECTION]

### 1. 최근 28일간 일별 트렌드 (Trend)
| 날짜 | 활성 사용자(명) | 세션(수) | 페이지뷰 | 참여율(%) |
|---|---|---|---|---|
`;

  // Trend 데이터 파싱
  reports.trend.rows?.forEach((row: any) => {
    const date = row.dimensionValues[0].value;
    const users = row.metricValues[0].value;
    const sessions = row.metricValues[1].value;
    const views = row.metricValues[2].value;
    const engagement = (parseFloat(row.metricValues[3].value) * 100).toFixed(1);
    prompt += `| ${date} | ${users} | ${sessions} | ${views} | ${engagement}% |\n`;
  });

  prompt += `
\n### 2. 상위 유입 경로 (Top 10 Sources)
| 소스(Source) | 매체(Medium) | 사용자 수 | 세션 수 |
|---|---|---|---|
`;

  // Source 데이터 파싱
  reports.source.rows?.forEach((row: any) => {
    const source = row.dimensionValues[0].value;
    const medium = row.dimensionValues[1].value;
    const users = row.metricValues[0].value;
    const sessions = row.metricValues[1].value;
    prompt += `| ${source} | ${medium} | ${users} | ${sessions} |\n`;
  });

  prompt += `
\n### 3. 상위 인기 페이지 (Top 10 Content)
| 페이지 제목 | 경로 | 조회수 | 평균 체류시간(초) |
|---|---|---|---|
`;

  // Page 데이터 파싱
  reports.page.rows?.forEach((row: any) => {
    const title = row.dimensionValues[0].value;
    const path = row.dimensionValues[1].value;
    const views = row.metricValues[0].value;
    const duration = parseFloat(row.metricValues[1].value).toFixed(1);
    prompt += `| ${title} | ${path} | ${views} | ${duration}s |\n`;
  });

  prompt += `
---
## 작성 가이드
- **전문적이지만 쉬운 어조**로 작성해주세요.
- 단순히 수치를 나열하지 말고, **"왜(Why)"** 그런 현상이 발생했는지 유입 경로와 페이지 데이터를 연결지어 추론해주세요.
- **마크다운(Markdown)** 형식을 사용하여 가독성 있게 작성해주세요.
- 결론 부분에는 **"💡 CEO를 위한 3줄 요약"**을 반드시 포함해주세요.
`;

  return prompt;
}
