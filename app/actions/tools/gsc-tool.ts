"use server";

export async function fetchGscData(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = ["query"] // 기본값: 검색어별 조회
) {
  if (!accessToken) throw new Error("Google Access Token이 없습니다.");
  if (!siteUrl)
    throw new Error("분석할 사이트 URL(Site URL)이 선택되지 않았습니다.");

  // Site URL 인코딩 (URL은 / 문자가 포함되므로 인코딩 필수)
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions,
        rowLimit: 10, // 상위 10개만 조회
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GSC API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (!data.rows || data.rows.length === 0) {
      return "검색 결과 데이터가 없습니다.";
    }

    // AI용 리포트 포맷팅
    let report = `[Google Search Console Report]\n`;
    // 헤더 생성
    const dimHeaders = dimensions.join(" | ");
    report += `${dimHeaders} | Clicks | Impressions | CTR | Position\n`;
    report += `${dimensions.map(() => "---").join("|")}---|---|---|---\n`;

    data.rows.forEach((row: any) => {
      const keys = row.keys.join(" | ");
      const ctr = (row.ctr * 100).toFixed(2) + "%";
      const position = row.position.toFixed(1);
      report += `${keys} | ${row.clicks} | ${row.impressions} | ${ctr} | ${position}\n`;
    });

    return report;
  } catch (error: any) {
    // 권한 에러 힌트 제공
    if (error.message.includes("403")) {
      return "ERROR: GSC 권한 부족. 해당 구글 계정이 서치 콘솔에 등록되어 있는지, 또는 API Scope가 추가되었는지 확인하세요.";
    }
    return `Error fetching GSC data: ${error.message}`;
  }
}
