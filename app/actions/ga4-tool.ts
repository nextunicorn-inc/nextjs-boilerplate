"use server";

import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { OAuth2Client } from "google-auth-library";

const getClient = (accessToken: string) => {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  return new BetaAnalyticsDataClient({ authClient: auth } as any);
};

// AI가 호출할 수 있는 "만능 도구"
export async function runDynamicReport(
  accessToken: string,
  propertyId: string,
  params: {
    startDate: string; // 예: '30daysAgo'
    endDate: string; // 예: 'today'
    dimensions: string[]; // 예: ['date', 'sessionSource']
    metrics: string[]; // 예: ['activeUsers', 'sessions']
    limit?: number;
  }
) {
  const client = getClient(accessToken);
  const property = propertyId.includes("properties/")
    ? propertyId
    : `properties/${propertyId}`;

  try {
    const response = await client.runReport({
      property,
      dateRanges: [{ startDate: params.startDate, endDate: params.endDate }],
      dimensions: params.dimensions.map((name) => ({ name })),
      metrics: params.metrics.map((name) => ({ name })),
      limit: params.limit || 10,
    });

    // AI가 읽기 편하게 CSV/Markdown 형태의 문자열로 변환하여 반환
    let output = `[Report Result]\n`;

    // 헤더 생성
    const dimHeaders = response[0].dimensionHeaders?.map((h) => h.name) || [];
    const metHeaders = response[0].metricHeaders?.map((h) => h.name) || [];
    output += `| ${[...dimHeaders, ...metHeaders].join(" | ")} |\n`;

    // 데이터 행 생성
    response[0].rows?.forEach((row) => {
      const dimVals = row.dimensionValues?.map((v) => v.value) || [];
      const metVals = row.metricValues?.map((v) => v.value) || [];
      output += `| ${[...dimVals, ...metVals].join(" | ")} |\n`;
    });

    return output;
  } catch (error: any) {
    console.error("Tool Execution Error:", error);
    return `Error fetching data: ${error.message}`;
  }
}
