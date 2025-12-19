"use server";

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { runDynamicReport } from "./ga4-tool";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 1. AI가 사용할 도구 정의 (타입 에러 수정됨)
const tools = {
  functionDeclarations: [
    {
      name: "get_ga4_report",
      description:
        "Google Analytics 4 데이터를 조회합니다. 날짜, 측정기준, 지표를 설정하여 호출하세요.",
      parameters: {
        type: SchemaType.OBJECT, // 문자열 대신 SchemaType 사용
        properties: {
          startDate: {
            type: SchemaType.STRING,
            description: "시작 날짜 (예: '30daysAgo', '2024-01-01')",
          },
          endDate: {
            type: SchemaType.STRING,
            description: "종료 날짜 (보통 'today')",
          },
          dimensions: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
              "분석 기준 (예: date, pageTitle, sessionSource, deviceCategory, country)",
          },
          metrics: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
              "수치 데이터 (예: activeUsers, screenPageViews, sessions, engagementRate)",
          },
          limit: {
            type: SchemaType.NUMBER,
            description: "가져올 데이터 행 수 (기본값 10)",
          },
        },
        required: ["startDate", "endDate", "dimensions", "metrics"],
      },
    },
  ],
};

export async function chatWithGemini(
  userMessage: string,
  accessToken: string,
  propertyId: string
) {
  // 2. 모델 초기화
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    // tools 배열 안에 위에서 만든 tools 객체를 넣습니다.
    tools: [tools],
  });

  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [
          {
            text: "당신은 전문 데이터 분석가입니다. 주어진 도구를 적극적으로 사용하여 데이터를 조회하고, 그 결과를 바탕으로 한국어로 친절하게 답변하세요.",
          },
        ],
      },
      {
        role: "model",
        parts: [
          { text: "네, 알겠습니다. GA4 데이터 분석을 도와드리겠습니다." },
        ],
      },
    ],
  });

  try {
    // 3. 사용자 질문 전송
    console.log("🗣️ 사용자 질문:", userMessage);
    const result = await chat.sendMessage(userMessage);
    const response = result.response;

    // functionCalls() 함수를 통해 도구 호출 여부 확인
    const functionCalls = response.functionCalls();

    // 4. AI가 "도구를 쓰겠다"고 했는지 확인
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      console.log("🤖 Gemini가 도구 사용을 요청함:", call.name, call.args);

      if (call.name === "get_ga4_report") {
        const args = call.args as any;

        // 5. 실제 GA4 API 실행 (Server Action)
        const apiResult = await runDynamicReport(accessToken, propertyId, {
          startDate: args.startDate,
          endDate: args.endDate,
          dimensions: args.dimensions || [],
          metrics: args.metrics || [],
          limit: args.limit || 10,
        });

        console.log("📊 데이터 조회 결과 확보 완료");

        // 6. 조회된 데이터를 AI에게 다시 전달 (Context 주입)
        const finalResult = await chat.sendMessage([
          {
            functionResponse: {
              name: "get_ga4_report",
              response: { result: apiResult }, // 결과값 전달
            },
          },
        ]);

        return finalResult.response.text();
      }
    }

    // 도구 사용 없이 그냥 대답한 경우
    return response.text();
  } catch (error) {
    console.error("Gemini Agent Error:", error);
    return "죄송합니다. 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
}
