import { fetchAmplitudeData } from "./amplitude-tool";

export async function validateAmplitude(apiKey: string, secretKey: string) {
  try {
    // 인증 유효성 검사를 위해 오늘 날짜와 더미 이벤트를 전달
    // fetchAmplitudeData 내부에서 에러가 발생하면 throw 되므로 catch로 이동함
    const dummyDate = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

    await fetchAmplitudeData(apiKey, secretKey, {
      start: dummyDate,
      end: dummyDate,
      event: "_active", // 인증 확인용 더미 이벤트
    });

    // 에러 없이 통과했다면 성공
    return { success: true };
  } catch (error: any) {
    console.error("Amplitude Validation Failed:", error.message);

    // 에러 발생 시 명확하게 실패 반환
    return {
      success: false,
      error: error.message || "Invalid API Key or Secret Key",
    };
  }
}
