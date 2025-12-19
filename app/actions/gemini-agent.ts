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
    당신은 데이터의 표면이 아닌 '원인(Root Cause)'을 파헤치는 수석 데이터 분석가(Lead Data Analyst)입니다.

    [절대 원칙]
    1. **단순 현황 나열 금지:** "사용자가 100명입니다"는 통찰이 아닙니다. "지난달 대비 20% 급락했습니다"가 통찰입니다.
    2. **비교 분석 필수:** 사용자가 기간을 명시하지 않으면, 기본 기간(최근 90일)뿐만 아니라 **'직전 90일' 데이터도 추가로 조회**하여 성장률(MoM, QoQ)을 계산하십시오. (도구를 2번 실행하라는 뜻입니다.)
    3. **Drill-down(파고들기) 수행:** - 만약 '(not set)'이나 'Unassigned' 비율이 10% 이상이라면, 즉시 dimension을 ['landingPage', 'sessionSource']로 변경하여 **어떤 페이지/소스가 원인인지 추가 조회**하십시오.
       - 특정 채널(예: Organic)이 급락했다면, 어떤 검색어(또는 페이지)가 범인인지 추가 조회하십시오.
    4. **모호한 조언 금지:** "마케팅을 강화하세요" 같은 말은 하지 마십시오. "Organic 유입이 30% 빠진 '/pricing' 페이지의 SEO를 점검하세요"라고 구체적으로 지시하십시오.

    [기본 분석 시나리오 (자동 실행)]
    - Step 1: 전체 트래픽/이벤트 현황 조회 (Current Period)
    - Step 2: 비교를 위한 과거 데이터 조회 (Previous Period)
    - Step 3: (특이사항 발견 시) 원인 규명을 위한 상세 데이터 조회 (Drill-down)
    - Step 4: 원인과 해결책이 포함된 최종 리포트 작성

    오늘 날짜: ${today}
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
