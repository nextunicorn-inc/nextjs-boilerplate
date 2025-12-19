"use server";

export async function fetchAmplitudeData(
  apiKey: string | undefined,
  secretKey: string | undefined,
  params: {
    start: string;
    end: string;
    event: string;
    groupBy?: string;
  }
) {
  // 1. 키가 없는 경우 명확한 에러 메시지 반환 (AI가 이걸 보고 사용자에게 요청함)
  if (!apiKey || !secretKey) {
    return "ERROR: AMPLITUDE_KEY_MISSING. (사용자가 앰플리튜드 키를 연동하지 않았습니다. 사용자에게 키를 등록해달라고 요청하세요.)";
  }

  // Amplitude Segmentation API 엔드포인트
  const url = "https://amplitude.com/api/2/events/segmentation";

  // Basic Auth 인코딩
  const auth = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");

  // 쿼리 파라미터 구성
  const query = new URLSearchParams({
    e: JSON.stringify({ event_type: params.event }),
    start: params.start,
    end: params.end,
    i: "30", // 30일 간격 (필요에 따라 1로 설정하여 일별 조회 가능)
  });

  if (params.groupBy) {
    query.append("g", params.groupBy);
  }

  try {
    const response = await fetch(`${url}?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Amplitude API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // --- AI가 읽기 편하게 데이터 포맷팅 (CSV 스타일) ---
    let output = `[Amplitude Report: ${params.event}]\n`;

    // 날짜 헤더 (xValues)
    const dates = data.data.xValues;
    output += `Date | ${dates.join(" | ")} |\n`;

    // 데이터 행 (series)
    data.data.series.forEach((row: any[], index: number) => {
      const label = data.data.seriesLabels
        ? data.data.seriesLabels[index]
        : "Total";
      // groupBy 결과가 있으면 라벨에 표시
      const groupName = Array.isArray(label) ? label.join("/") : "All Users";

      output += `${groupName} | ${row.join(" | ")} |\n`;
    });

    return output;
  } catch (error: any) {
    console.error("Amplitude Tool Error:", error);
    return `Error fetching Amplitude data: ${error.message}`;
  }
}
