"use server";

export async function fetchAmplitudeData(
  apiKey: string,
  secretKey: string,
  params: { start: string; end: string; event: string; groupBy?: string }
) {
  // Segmentation API 엔드포인트
  const endpoint = "https://amplitude.com/api/2/events/segmentation";

  // Basic Auth 헤더 생성
  const auth = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");

  // 파라미터 구성
  const queryParams = new URLSearchParams({
    e: JSON.stringify({ event_type: params.event }),
    start: params.start,
    end: params.end,
  });

  if (params.groupBy) {
    queryParams.append("g", params.groupBy);
  }

  // try-catch 없이 요청하여 네트워크 에러 등은 상위로 전파
  const response = await fetch(`${endpoint}?${queryParams}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Amplitude API Error: ${response.status}`;

    try {
      // 에러 메시지가 JSON이면 파싱해서 상세 내용을 추출
      const errorJson = JSON.parse(errorText);

      // Amplitude 에러 구조 예: {"error": {"message": "...", "metadata": {"details": "..."}}}
      // 가장 구체적인 에러 메시지 순서로 탐색
      const detailMsg =
        errorJson.error?.metadata?.details || // 1. 상세 디테일 (Invalid API Key 등)
        errorJson.error?.message || // 2. 에러 메시지
        errorJson.message || // 3. 최상위 메시지
        (typeof errorJson.error === "string" ? errorJson.error : null); // 4. 에러가 문자열인 경우

      if (detailMsg) {
        errorMessage += ` - ${detailMsg}`;
      } else {
        // 객체 구조를 알 수 없는 경우 문자열로 변환하여 첨부 (방어 로직)
        const fallbackObj = errorJson.error || errorJson;
        errorMessage += ` - ${JSON.stringify(fallbackObj)}`;
      }
    } catch {
      // JSON 파싱 실패 시 원본 텍스트 사용
      errorMessage += ` ${errorText}`;
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data;
}
