"use server";

import {
  GoogleGenerativeAI,
  SchemaType,
  type Tool,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { runDynamicReport } from "./ga4-tool";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const ga4Tool: Tool = {
  functionDeclarations: [
    {
      name: "get_ga4_report",
      description:
        "Google Analytics 4 데이터를 조회합니다. 날짜, 측정기준, 지표를 설정하여 호출하세요.",
      parameters: {
        type: SchemaType.OBJECT,
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
            description: "분석 기준",
          },
          metrics: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "수치 데이터",
          },
          limit: {
            type: SchemaType.NUMBER,
            description: "가져올 데이터 행 수",
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
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    // 💡 [핵심 수정] 안전 필터를 끕니다. (데이터 분석 시 필수)
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
    tools: [ga4Tool],
  });

  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [
          {
            text: "당신은 전문 데이터 분석가입니다. 주어진 도구를 사용하여 데이터를 조회하고, 그 결과를 바탕으로 한국어로 친절하게 답변하세요.",
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
    console.log("🗣️ 사용자 질문:", userMessage);
    const result = await chat.sendMessage(userMessage);
    const response = result.response;

    // AI가 도구를 쓰려고 하는지 확인
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      console.log("🤖 Gemini가 도구 사용을 요청함:", call.name, call.args);

      if (call.name === "get_ga4_report") {
        const args = call.args as any;

        // 실제 GA4 데이터 가져오기
        const apiResult = await runDynamicReport(accessToken, propertyId, {
          startDate: args.startDate,
          endDate: args.endDate,
          dimensions: args.dimensions || [],
          metrics: args.metrics || [],
          limit: args.limit || 10,
        });

        console.log("📊 데이터 조회 완료, AI에게 전달 중...");

        // 데이터와 함께 최종 답변 요청
        const finalResult = await chat.sendMessage([
          {
            functionResponse: {
              name: "get_ga4_report",
              response: { result: apiResult },
            },
          },
        ]);

        // 💡 [방어 코드] 답변이 비어있는지 확인
        const finalText = finalResult.response.text();
        if (!finalText) {
          return "데이터는 조회했으나, AI가 답변을 생성하지 못했습니다. (빈 응답)";
        }
        return finalText;
      }
    }

    // 도구 없이 바로 대답한 경우
    const text = response.text();
    if (!text) return "AI가 답변을 거부했습니다. (Safety Filter 가능성)";

    return text;
  } catch (error: any) {
    console.error("🔥 Gemini Agent Error:", error);

    if (error.message?.includes("429")) {
      return "잠시만 기다려주세요! (무료 버전 사용량 초과 20초 대기)";
    }
    return `분석 중 오류가 발생했습니다: ${error.message}`;
  }
}
