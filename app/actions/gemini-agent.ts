"use server";

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  FunctionCallingMode,
} from "@google/generative-ai";
import { Ga4Tool, AmplitudeTool, type AgentTool } from "./tools/definitions";

const REGISTERED_TOOLS: AgentTool[] = [Ga4Tool, AmplitudeTool];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function chatWithGemini(
  userMessage: string,
  apiKeys: { [key: string]: string | undefined }
) {
  // 1. 도구 정의
  const toolsConfig = {
    functionDeclarations: REGISTERED_TOOLS.map((tool) => tool.declaration),
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-pro-latest",
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.5,
    },
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
    // 🔥 [수정 1] 도구 설정에 'AUTO' 모드 명시 (선택적)
    // 대부분의 경우 기본값이지만, 명시적으로 선언하여 도구 사용을 장려함
    tools: [toolsConfig as any],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  });

  const today = new Date().toISOString().split("T")[0];

  // 2. 시스템 프롬프트 강화 (수동적인 태도 금지)
  const systemInstruction = `
    당신은 데이터의 '근본 원인(Root Cause)'을 찾아내는 수석 데이터 분석가입니다.

    [행동 원칙 - 매우 중요]
    1. **절대 사용자에게 데이터를 요청하지 마십시오.** 당신에게는 GA4와 Amplitude에 접속할 수 있는 권한과 도구가 이미 있습니다.
    2. **"데이터를 조회하겠습니다"라고 말만 하지 말고, 즉시 해당 도구(Function Call)를 실행하십시오.**
    3. 사용자의 질문이 모호하면, 스스로 판단하여 [최근 90일 vs 직전 90일] 비교 데이터를 조회하십시오.
    4. 분석에 필요한 데이터가 없다면 "데이터가 없습니다"라고 하지 말고, 도구를 실행하여 빈 데이터라도 확인한 후 보고하십시오.

    [분석 프로세스]
    1. 현황 파악 (Current Data) -> 도구 실행!
    2. 추세 비교 (Historical Data) -> 도구 실행!
    3. 원인 규명 (Drill-down) -> 도구 실행!
    4. 최종 전략 리포트 작성

    오늘 날짜: ${today}
  `;

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemInstruction }] },
      {
        role: "model",
        parts: [
          {
            text: "확인했습니다. 질문을 받으면 사용자에게 되묻지 않고, 즉시 도구를 실행하여 데이터를 확보한 뒤 분석하겠습니다.",
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
    const MAX_LOOPS = 15; // 루프 횟수 조금 더 넉넉하게

    // 3. 도구 실행 루프
    while (functionCalls && functionCalls.length > 0 && loopCount < MAX_LOOPS) {
      loopCount++;
      const call = functionCalls[0];
      console.log(`🤖 [Loop ${loopCount}] 도구 실행: ${call.name}`, call.args);

      const targetTool = REGISTERED_TOOLS.find(
        (tool) => tool.name === call.name
      );
      let apiResult = "";

      if (targetTool) {
        try {
          // 키가 없으면 에러 메시지를 리턴하므로 AI가 알 수 있음
          apiResult = await targetTool.execute(call.args, apiKeys);
        } catch (e: any) {
          apiResult = `Error executing tool: ${e.message}`;
        }
      } else {
        apiResult = `Error: Unknown tool '${call.name}'`;
      }

      console.log(`📊 [Loop ${loopCount}] 데이터 확보 완료.`);

      // 결과 전달
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

    // 4. [중요] 루프가 끝난 후, 최종 리포트 작성 요청
    // 여기서 AI가 데이터를 다 보고 나서 할 말을 정리하도록 시킵니다.
    const finalRequest = await chat.sendMessage(
      "지금까지 도구로 조회한 모든 데이터를 종합하여, 사용자의 질문에 대한 최종 답변을 작성해. 분석 근거(수치)를 반드시 포함해야 해."
    );

    const finalText = finalRequest.response.text();
    if (!finalText) return "분석을 완료했으나 리포트 생성에 실패했습니다.";

    return finalText;
  } catch (error: any) {
    console.error("🔥 Agent Error:", error);
    if (error.message?.includes("429"))
      return "잠시만 기다려주세요! (무료 티어 사용량 초과)";
    return `시스템 오류: ${error.message}`;
  }
}
