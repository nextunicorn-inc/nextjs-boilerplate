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
    model: "gemini-1.5-flash",
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
            text: "당신은 전문 데이터 분석가입니다. 질문을 해결하기 위해 필요한 데이터가 있다면 도구를 여러 번 사용해도 좋습니다. 최종적으로 한국어로 요약된 인사이트를 제공하세요.",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "네, 알겠습니다. 데이터를 깊이 있게 분석하여 인사이트를 드리겠습니다.",
          },
        ],
      },
    ],
  });

  try {
    console.log("🗣️ 사용자 질문:", userMessage);

    // 1. 첫 요청 전송
    let result = await chat.sendMessage(userMessage);
    let response = result.response;
    let functionCalls = response.functionCalls();

    // 🔄 [핵심 수정] while 루프를 사용하여 도구 호출이 없을 때까지 반복
    // (최대 5회로 제한하여 무한 루프 방지)
    let loopCount = 0;
    const MAX_LOOPS = 5;

    while (functionCalls && functionCalls.length > 0 && loopCount < MAX_LOOPS) {
      loopCount++;
      const call = functionCalls[0];
      console.log(
        `🤖 [Loop ${loopCount}] 도구 실행 요청:`,
        call.name,
        call.args
      );

      if (call.name === "get_ga4_report") {
        const args = call.args as any;

        // 2. 도구 실행
        const apiResult = await runDynamicReport(accessToken, propertyId, {
          startDate: args.startDate,
          endDate: args.endDate,
          dimensions: args.dimensions || [],
          metrics: args.metrics || [],
          limit: args.limit || 10,
        });

        console.log(
          `📊 [Loop ${loopCount}] 데이터 확보 완료. 결과를 AI에게 전달합니다.`
        );

        // 3. 실행 결과를 AI에게 전달하고 **다음 반응**을 기다림
        result = await chat.sendMessage([
          {
            functionResponse: {
              name: "get_ga4_report",
              response: { result: apiResult },
            },
          },
        ]);

        // 4. AI의 새로운 응답 확인 (또 도구를 쓰려는지, 아니면 답변을 줄지)
        response = result.response;
        functionCalls = response.functionCalls();
      }
    }

    // 루프가 끝나면 최종 텍스트 답변 반환
    const finalText = response.text();
    if (!finalText) return "분석을 완료했으나 답변을 생성하지 못했습니다.";

    return finalText;
  } catch (error: any) {
    console.error("🔥 Gemini Agent Error:", error);
    if (error.message?.includes("429"))
      return "잠시만 기다려주세요! (무료 버전 사용량 초과)";
    return `오류 발생: ${error.message}`;
  }
}
