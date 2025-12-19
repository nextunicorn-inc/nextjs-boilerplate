"use server";

export interface Ga4Property {
  id: string; // properties/12345
  numericId: string; // 12345 (우리가 필요한 것)
  displayName: string; // "My Website"
}

export async function getGa4Properties(
  accessToken: string
): Promise<Ga4Property[]> {
  try {
    // 1. Account Summary API 호출 (계정 + 속성 계층 구조 조회)
    // 이 API는 사용자가 볼 수 있는 모든 GA4 속성을 요약해서 줍니다.
    const response = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch GA4 properties", await response.text());
      return [];
    }

    const data = await response.json();
    const summaries = data.accountSummaries || [];

    const properties: Ga4Property[] = [];

    // 2. 데이터 파싱
    for (const summary of summaries) {
      if (summary.propertySummaries) {
        for (const prop of summary.propertySummaries) {
          // propertySummaries 안에 있는 속성들 추출
          // prop.property 문자열은 "properties/312345" 형태입니다.
          const numericId = prop.property.split("/")[1];

          properties.push({
            id: prop.property,
            numericId: numericId,
            displayName: `${summary.displayName} - ${prop.displayName}`, // "계정명 - 속성명"
          });
        }
      }
    }

    return properties;
  } catch (error) {
    console.error("Error fetching properties:", error);
    return [];
  }
}
