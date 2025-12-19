"use server";

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { Ga4Tool, AmplitudeTool, type AgentTool } from "./tools/definitions";

const REGISTERED_TOOLS: AgentTool[] = [Ga4Tool, AmplitudeTool];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function chatWithGemini(
  userMessage: string,
  apiKeys: { [key: string]: string | undefined }
) {
  const toolsConfig = {
    functionDeclarations: REGISTERED_TOOLS.map((tool) => tool.declaration),
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    // 🔥 [수정 1] 긴 리포트가 잘리지 않도록 토큰 한도 대폭 상향
    generationConfig: {
      maxOutputTokens: 8192,
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
    tools: [toolsConfig as any],
  });

  const today = new Date().toISOString().split("T")[0];

  const systemInstruction = `
    당신은 데이터의 '원인(Root Cause)'을 파헤치는 수석 데이터 분석가(Lead Data Analyst)입니다.

    [절대 원칙]
    1. **단순 현황 나열 금지:** "사용자가 100명입니다"는 통찰이 아닙니다. "지난달 대비 20% 급락했습니다"가 통찰입니다.
    2. **비교 분석 필수:** 사용자가 기간을 명시하지 않으면, 기본 기간(최근 90일)뿐만 아니라 **'직전 90일' 데이터도 추가로 조회**하여 성장률(MoM, QoQ)을 계산하십시오. (도구를 2번 실행하라는 뜻입니다.)
    3. **Drill-down 수행:** 특이점(급상승, 급락, Unassigned) 발견 시 즉시 상세 원인을 추가 조회하십시오.
    
    [기본 분석 시나리오]
    - Step 1: 전체 트래픽 현황 (Current)
    - Step 2: 과거 비교 (Previous)
    - Step 3: 원인 상세 분석 (Drill-down)
    - Step 4: 해결책 제안

    오늘 날짜: ${today}
  `;

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemInstruction }] },
      {
        role: "model",
        parts: [
          {
            text: "네, 데이터를 집요하게 파고들어 원인과 해결책이 포함된 완벽한 리포트를 작성하겠습니다.",
          },
        ],
      },
    ],
  });

  try {
    console.log("🗣️ 사용자 질문:", userMessage);

    // 1. 첫 요청
    let result = await chat.sendMessage(userMessage);
    let response = result.response;
    let functionCalls = response.functionCalls();

    let loopCount = 0;
    const MAX_LOOPS = 10;

    // 2. 데이터 수집 루프 (Agent Loop)
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
          apiResult = await targetTool.execute(call.args, apiKeys);
        } catch (e: any) {
          apiResult = `Error executing tool: ${e.message}`;
        }
      } else {
        apiResult = `Error: Unknown tool '${call.name}'`;
      }

      console.log(`📊 [Loop ${loopCount}] 데이터 확보 완료.`);

      // 결과 전달 및 다음 행동 대기
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

    // 🔥 [수정 2] 루프가 끝난 후, '강제 종합 리포트' 요청
    // 마지막 응답이 Step 4만 덜렁 있는 경우가 많으므로,
    // "지금까지 모은 거 다 합쳐서 제대로 써줘"라고 명령을 한 번 더 보냅니다.
    console.log("📝 최종 리포트 생성 요청 중...");

    const finalRequest = await chat.sendMessage(
      "지금까지 조회한 모든 데이터(Step 1~3 등)를 종합하여, 끊김 없이 완벽한 서론-본론-결론 구조의 최종 리포트를 작성해. Markdown 형식을 사용하여 가독성을 높여줘."
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
