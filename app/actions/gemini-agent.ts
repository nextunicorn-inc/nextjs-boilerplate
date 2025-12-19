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
    model: "gemini-flash-latest",
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

  // 2. 시스템 프롬프트 강화 (수동적인 태도 금지)
  const systemInstruction = `
    당신은 수석 데이터 분석가입니다.

    [핵심 원칙]
    1. **능동적 도구 사용:** 당신에게는 다양한 데이터 분석 도구에 접근할 수 있는 권한이 부여되어 있습니다. 사용자에게 데이터를 요청하거나 권한을 묻지 말고, 즉시 필요한 도구를 선택하여 실행하십시오.
    2. **실행 우선:** "데이터를 확인해 보겠습니다"라고 말하는 대신, 바로 Function Call을 생성하여 데이터를 가져오십시오.
    3. **자율적 판단:** 사용자의 질문이 모호할 경우, 분석가로서의 직관을 발휘하여 가장 적절한 기간(통상 최근 3개월 등)과 지표를 스스로 설정하여 비교 분석을 수행하십시오.
    4. **결과 중심:** 도구 실행 결과가 비어있거나 에러가 나더라도, 그 사실 자체를 분석의 근거로 삼아 보고하십시오.
  `;

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemInstruction }] },
      {
        role: "model",
        parts: [
          {
            text: "알겠습니다. 부여된 도구들을 자유롭게 활용하여 주도적으로 데이터를 분석하겠습니다.",
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
      "조회된 데이터를 바탕으로 최종 답변을 작성해."
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
