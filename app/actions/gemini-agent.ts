"use server";

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import {
  Ga4Tool,
  AmplitudeTool,
  GscTool,
  type AgentTool,
} from "./tools/definitions";

const REGISTERED_TOOLS: AgentTool[] = [
  Ga4Tool,
  GscTool,
  AmplitudeTool,
  // StripeTool,
  // SentryTool,
];

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
    generationConfig: { maxOutputTokens: 8192, temperature: 0.5 },
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
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
  });

  const todayDate = new Date();
  const todayString = todayDate.toISOString().split("T")[0];
  const currentYear = todayDate.getFullYear();

  // 🔥 [업그레이드] 시스템 프롬프트: 날짜 계산, GSC 에러 방지, 환각 방지 강화
  const systemInstruction = `
    You are a friendly and professional 'Data Analysis Partner' for non-technical business stakeholders.

    [Critical Context]
    - **Current Date:** ${todayString} (Year: ${currentYear})
    - **Period Calculation:** - "Last Month" or "Recent Month" = From (Today - 30 days) to (Today).
      - Do NOT assume a 2-month range for "1 month". Be precise with dates.
    - **Default Period:** If unspecified, assume the **last 90 days** (Quarterly view).

    [Tone & Style Guidelines (Very Important)]
    1. **NO Jargon / Easy Language:** Avoid abbreviations like "CTR", "SEO" alone. Use easy explanations in parentheses.
    2. **NO Process Description:** - Do NOT describe what you did (e.g., "I checked the data...", "I called the tool...").
       - Do NOT say "I will check...".
       - **Just state the INSIGHTS directly.** (e.g., "The bounce rate increased because of channel X.")
    3. **Direct & Clean:** Remove grand titles. Start directly with the summary.
    4. **Visual Distinction:** Use 🟢(Positive) and 🔴(Negative) emojis.

    [Analysis Strategy (CRITICAL)]
    - **Compare:** Always compare Current vs Previous period.
    - **Deep Dive NOW (Do NOT Defer):** - If you need more detailed data (e.g., specific keywords, landing pages) to explain a trend, **EXECUTE the tool immediately within this session.** - **NEVER** suggest "analyzing detailed data" as an Action Plan. You must do it yourself right now.
    - **Cross-Check:** Traffic up but Revenue down? Check Errors or Conversion Rate.

    [⚠️ Technical Constraints & Anti-Hallucination]
    1. **Google Search Console (GSC):**
       - **NEVER send empty dimensions.** If you need total clicks/impressions, use **dimensions=['date']**.
       - Empty dimensions cause system errors. Always specify at least one dimension like 'date', 'query', or 'page'.
    2. **Data Integrity (NO FAKE NUMBERS):**
       - You MUST use the **EXACT numbers** returned by the tool execution logs.
       - **NEVER** invent numbers like "1,000,000" or round them significantly if the data says "48,910".
       - If the tool returns an error or no data, explicitly state "No data available" or the error message. Do NOT make up a "likely scenario".

    [Reporting Format (Korean)]
    Answer in **Korean** following this structure:
    1. **📝 요약 (Summary):** A 1-sentence summary of the key finding.
    2. **📊 주요 지표 (Key Metrics):** Markdown Table comparing Current vs Previous. (Use REAL numbers from logs)
    3. **🧐 원인 분석 (Insight):** - 🟢 Positive Factor: ...
       - 🔴 Risk Factor: ...
       * (Provide specific reasons found through drill-down analysis)*
    4. **🚀 실행 계획 (Action Plan):** - **MUST be Business/Marketing actions** (e.g., "Change the button color", "Increase budget"). 
       - **Do NOT include "Analyze data" or "Check reports" here.** (You have already done that.)

    **Remember:** You are explaining to a non-tech CEO. Be insightful but easy to understand.
  `;

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemInstruction }] },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I will use the exact data from the logs, prevent GSC errors by always setting dimensions, and provide precise analysis.",
          },
        ],
      },
    ],
  });

  try {
    console.log("🗣️ [User Question]:", userMessage);

    let result = await chat.sendMessage(userMessage);
    let response = result.response;
    let functionCalls = response.functionCalls();

    let loopCount = 0;
    const MAX_LOOPS = 15;

    // --- 도구 실행 루프 ---
    while (functionCalls && functionCalls.length > 0 && loopCount < MAX_LOOPS) {
      loopCount++;
      const call = functionCalls[0];

      console.log(
        `\n================= 🤖 Tool Execution [Step ${loopCount}] =================`
      );
      console.log(`🛠️ Tool Name: ${call.name}`);
      console.log(`📥 Input Params:`, JSON.stringify(call.args, null, 2));

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

      console.log(`📤 Output Data:`);
      // 데이터가 너무 길 경우 생략하여 출력 (전체 데이터는 AI에게 전달됨)
      if (apiResult.length > 1000) {
        console.log(
          apiResult.substring(0, 1000) + "\n... (more data sent to AI) ..."
        );
      } else {
        console.log(apiResult);
      }
      console.log(
        `==================================================================\n`
      );

      // 🔄 결과를 AI에게 전달하고, AI의 '다음 반응'을 받음
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

    // 🔥 [수정됨] 루프 종료 후 처리 로직 개선

    // Case 1: 루프가 횟수 초과로 강제 종료된 경우 (아직 할 말이 남았을 수 있음)
    if (loopCount >= MAX_LOOPS) {
      const finalRequest = await chat.sendMessage(
        "You have reached the tool execution limit. Please summarize the data you have gathered so far and provide a final answer in Korean."
      );
      return finalRequest.response.text();
    }

    // Case 2: 정상 종료 (더 이상 도구를 쓸 필요가 없음 -> 이미 답변을 생성했음)
    // 이때 response.text()에는 도구 결과를 보고 생성한 최종 답변이 들어있습니다.
    const finalText = response.text();

    if (!finalText) {
      // 혹시라도 텍스트가 비어있다면(매우 드뭄), 강제로 요청
      const retryRequest = await chat.sendMessage(
        "Please provide the final analysis results in Korean based on the data collected."
      );
      return retryRequest.response.text();
    }

    return finalText;
  } catch (error: any) {
    console.error("🔥 Agent Error:", error);
    if (error.message?.includes("429"))
      return "잠시만 기다려주세요! (무료 티어 사용량 초과)";
    return `시스템 오류: ${error.message}`;
  }
}
