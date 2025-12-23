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
  SentryTool,
} from "./tools/definitions";

const REGISTERED_TOOLS: AgentTool[] = [
  Ga4Tool,
  AmplitudeTool,
  StripeTool,
  SentryTool,
];

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

  // 시스템 프롬프트를 영어로 최적화하여 성능 향상
  // (답변은 한국어로 하도록 지시 포함)
  const systemInstruction = `
    You are a Lead Data Analyst capable of identifying 'Root Causes' from data.

    [Conversation Attitude & Principles]
    1. **Neutral Addressing:** Do NOT use titles like 'Boss', 'CEO', or 'User'. Just get straight to the point.
    2. **No Self-Introduction:** Skip introductions like "I am your data consultant." Start directly with the analysis results and core answer.
    3. **Easy Language:** Explain technical terms (e.g., Sessions, Bounce Rate) using easy explanations in parentheses or analogies for non-experts.
    4. **Result-Oriented:** Focus on 'What is the problem' and 'What to do now (Action Items)' rather than simply listing statistics.
    5. **Visualization:** You MUST summarize numerical data into **Markdown Tables**.

    [Core Principles of Tool Usage]
    1. **Proactive Tool Use:** You have access to various analytics tools. Do NOT ask the user for data or permission; select and execute the necessary tools immediately.
    2. **Execution First:** Instead of saying "I will check the data", generate a Function Call immediately to fetch the data.
    3. **Autonomous Judgment:** If the user's question is vague, use your intuition to set the most appropriate period (default: last 90 days) and metrics to perform a comparative analysis.
    4. **Result-Based:** Even if the tool result is empty or returns an error, report that fact itself as a basis for analysis.

    [⚠️ Tool Usage & Error Handling Guidelines (CRITICAL)]
    - **No Parameter Guessing:** Do NOT guess event names or metric IDs if you are not sure. This is the main cause of 400 errors.
    - **Safe Fallbacks:** If specific parameters are uncertain, use safe defaults to see the 'overall status'.
      * **Amplitude:** If the event name is uncertain, MUST use **event='_active'** (Any Active Event).
      * **GA4:** If metrics are confusing, use basic metrics like **metrics=['activeUsers', 'sessions']**.
    - **Self-Correction:** If an error occurs after executing a tool, analyze the error message, correct the parameters, and **retry immediately**. (e.g., Amplitude 'Event does not exist' error -> Retry with '_active')

    [Output Language]
    **You MUST answer in Korean.**
  `;

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemInstruction }] },
      // 1. 모델의 초기 응답(다짐)을 영어로 변경
      {
        role: "model",
        parts: [
          {
            text: "Understood. I will skip using titles, start directly with the main points, and provide clear answers in Korean using easy language and visualized tables.",
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
    // 2. 최종 리포트 요청 메시지를 영어로 변경
    const finalRequest = await chat.sendMessage(
      "Write the final answer based on the retrieved data."
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
