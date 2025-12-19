"use server";

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

// 위에서 만든 도구들 가져오기
import { Ga4Tool, AmplitudeTool, type AgentTool } from "./tools/definitions";

// 🛠️ [확장성 핵심] 여기에 툴을 추가하기만 하면 끝납니다.
const REGISTERED_TOOLS: AgentTool[] = [
  Ga4Tool,
  AmplitudeTool,
  // MixpanelTool, // 나중에 주석만 풀면 됨
];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function chatWithGemini(
  userMessage: string,
  apiKeys: { [key: string]: string | undefined } // 키 타입도 유연하게 변경
) {
  // 1. 등록된 도구들의 선언문(Declaration)만 뽑아서 Gemini에게 전달
  const toolsConfig = {
    functionDeclarations: REGISTERED_TOOLS.map((tool) => tool.declaration),
  };

  const model = genAI.getGenerativeModel({
    // 요청하신 모델명 적용 (latest alias 사용)
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
    // any 캐스팅 없이 깔끔하게 주입
    tools: [toolsConfig as any],
  });

  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [
          {
            text: "당신은 데이터 분석 통합 에이전트입니다. 제공된 도구들을 자유롭게 사용하여 질문에 답하세요. 키가 없으면 요청하세요.",
          },
        ],
      },
      {
        role: "model",
        parts: [
          { text: "확인했습니다. 연결된 모든 분석 도구를 활용하겠습니다." },
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
      console.log(`🤖 [Loop ${loopCount}] 도구 실행 요청: ${call.name}`);

      // 🔍 [핵심 로직] 리스트에서 이름이 일치하는 도구를 찾아서 실행 (Dynamic Dispatch)
      const targetTool = REGISTERED_TOOLS.find(
        (tool) => tool.name === call.name
      );

      let apiResult = "";

      if (targetTool) {
        try {
          // 해당 도구의 execute 함수 실행 (내부 로직은 몰라도 됨)
          apiResult = await targetTool.execute(call.args, apiKeys);
        } catch (e: any) {
          apiResult = `Tool Execution Error: ${e.message}`;
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
