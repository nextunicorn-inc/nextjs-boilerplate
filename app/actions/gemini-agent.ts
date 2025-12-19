"use server";

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { Ga4Tool, AmplitudeTool, type AgentTool } from "./tools/definitions";

// 등록된 도구 리스트
const REGISTERED_TOOLS: AgentTool[] = [Ga4Tool, AmplitudeTool];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function chatWithGemini(
  userMessage: string,
  apiKeys: { [key: string]: string | undefined }
) {
  // 1. 도구 설정
  const toolsConfig = {
    functionDeclarations: REGISTERED_TOOLS.map((tool) => tool.declaration),
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
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
    tools: [toolsConfig as any],
  });

  // 2. 현재 날짜 정보 생성
  const today = new Date().toISOString().split("T")[0];

  // 3. [핵심 수정] 시스템 프롬프트 강화: 기본 기간을 3개월(90일)로 변경
  const systemInstruction = `
    당신은 데이터 기반 의사결정을 돕는 최고의 'Chief Data Officer(CDO)'입니다.
    
    [행동 지침]
    1. 사용자의 질문이 "요즘 어때?", "문제점이 뭐야?" 처럼 모호하더라도, **절대 사용자에게 매개변수를 되묻지 마십시오.**
    2. 대신, 당신의 전문적인 판단으로 **가장 적절한 기간(기본값: 최근 3개월/분기)과 지표(방문자수, 전환율 등)를 스스로 가정(Assume)하여 도구를 즉시 실행**하십시오.
    3. 도구 실행에 필요한 키(API Key)는 시스템이 이미 가지고 있다고 가정하십시오. "권한이 없다"는 말을 하지 마십시오.
    4. 만약 특정 도구 실행 시 에러가 발생하면, 에러 메시지를 분석하여 사용자에게 "어떤 키가 누락되었는지" 정확히 안내하십시오.
    5. 오늘 날짜는 ${today} 입니다.

    [기본 분석 전략 (사용자가 구체적이지 않을 때)]
    - GA4: startDate='90daysAgo', endDate='today', metrics=['activeUsers', 'sessions', 'screenPageViews']
    - Amplitude: start='(90일 전 YYYYMMDD)', end='(오늘 YYYYMMDD)', event='(주요 이벤트가 있다면 추론, 없으면 Any Active Event)'
  `;

  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: systemInstruction }],
      },
      {
        role: "model",
        parts: [
          {
            text: "알겠습니다. 사용자의 질문이 모호할 경우, 자동으로 최근 3개월(분기) 데이터를 조회하여 심층적인 인사이트를 제공하겠습니다.",
          },
        ],
      },
    ],
  });

  try {
    console.log("🗣️ 사용자 질문:", userMessage);

    let result = await chat.sendMessage(userMessage);
    let response = result.response;
    let functionCalls = response.functionCalls();

    let loopCount = 0;
    const MAX_LOOPS = 10;

    while (functionCalls && functionCalls.length > 0 && loopCount < MAX_LOOPS) {
      loopCount++;
      const call = functionCalls[0];
      console.log(
        `🤖 [Loop ${loopCount}] 도구 실행 요청: ${call.name}`,
        call.args
      );

      // 🔍 도구 찾기 및 실행
      const targetTool = REGISTERED_TOOLS.find(
        (tool) => tool.name === call.name
      );
      let apiResult = "";

      if (targetTool) {
        try {
          // 키 전달
          apiResult = await targetTool.execute(call.args, apiKeys);
        } catch (e: any) {
          apiResult = `Error executing tool: ${e.message}`;
        }
      } else {
        apiResult = `Error: Unknown tool '${call.name}'`;
      }

      console.log(`📊 [Loop ${loopCount}] 데이터 확보 완료 (${call.name})`);

      result = await chat.sendMessage([
        {
          functionResponse: {
            name: call.name,
            response: { result: apiResult },
          },
        },
      ]);

      response = result.response;
      functionCalls = response.functionCalls();
    }

    const finalText = response.text();
    if (!finalText) return "분석을 완료했으나 답변을 생성하지 못했습니다.";

    return finalText;
  } catch (error: any) {
    console.error("🔥 Agent Error:", error);
    if (error.message?.includes("429"))
      return "잠시만 기다려주세요! (무료 티어 사용량 초과)";
    return `시스템 오류: ${error.message}`;
  }
}
