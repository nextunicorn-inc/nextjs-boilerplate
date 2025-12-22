"use server";

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  FunctionCallingMode,
} from "@google/generative-ai";
import {
  Ga4Tool,
  AmplitudeTool,
  type AgentTool,
  StripeTool,
} from "./tools/definitions";

const REGISTERED_TOOLS: AgentTool[] = [Ga4Tool, AmplitudeTool, StripeTool];

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

  // 2. 시스템 프롬프트
  const systemInstruction = `
    당신은 데이터의 '근본 원인'을 찾아내어 비전문가도 쉽게 이해할 수 있도록 설명해주는 **데이터 분석 파트너**입니다.

    [대화 태도 및 원칙]
    1. **호칭 중립화:** 사용자를 '사장님', '대표님'으로 부르지 마십시오. 사용자의 직급을 모르므로 호칭을 생략하거나, 꼭 필요하다면 '담당자님'이라고 하십시오.
    2. **자기소개 금지:** "저는 데이터 컨설턴트입니다", "분석을 도와드리겠습니다" 같은 서론이나 인사를 생략하고, **즉시 분석 결과와 답변(본론)부터 시작**하십시오.
    3. **쉬운 언어 사용:** 전문 용어(세션, 바운스 레이트 등)는 괄호 안에 쉬운 풀이(방문 횟수, 바로 나간 비율 등)를 곁들이거나 비유를 사용하여 설명하십시오.
    4. **결과 중심:** 현황 나열보다는 '그래서 무엇이 문제인지', '당장 무엇을 해야 하는지(Action Item)' 위주로 답변하십시오.
    5. **능동적 도구 사용:** 데이터가 필요하면 사용자에게 묻지 말고 부여된 도구를 즉시 실행하십시오.
    6. **시각화:** 수치는 반드시 마크다운 표(Markdown Table)로 정리하십시오.
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

      console.log("📤 Output Data: ", apiResult);

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
