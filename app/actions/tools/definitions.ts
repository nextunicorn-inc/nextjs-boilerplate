import { runDynamicReport } from "./ga4-tool";
import { fetchAmplitudeData } from "./amplitude-tool";
import { FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { fetchStripeData } from "./stripe-tool";
import { fetchSentryIssues } from "./sentry-tool";

// 1. [규격] 모든 도구는 이 인터페이스를 따라야 합니다.
export interface AgentTool {
  name: string;
  declaration: FunctionDeclaration; // AI에게 보여줄 설명서 (JSON)
  execute: (args: any, keys: any) => Promise<string>; // 실제 실행 함수
}

// 2. [구현] GA4 도구 객체
export const Ga4Tool: AgentTool = {
  name: "get_ga4_report",
  declaration: {
    name: "get_ga4_report",
    description:
      "웹사이트 트래픽(유입, 페이지뷰, 방문자) 분석 도구. (소스: GA4)",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: {
          type: SchemaType.STRING,
          description: "YYYY-MM-DD or '30daysAgo'",
        },
        endDate: {
          type: SchemaType.STRING,
          description: "YYYY-MM-DD or 'today'",
        },
        dimensions: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        metrics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        limit: { type: SchemaType.NUMBER },
      },
      required: ["startDate", "endDate", "dimensions", "metrics"],
    },
  },
  execute: async (args, keys) => {
    if (!keys.ga4AccessToken || !keys.ga4PropertyId) {
      return "ERROR: GA4_NOT_CONNECTED. (Property ID 또는 로그인이 필요합니다.)";
    }
    return await runDynamicReport(
      keys.ga4AccessToken,
      keys.ga4PropertyId,
      args
    );
  },
};

// 3. [구현] Amplitude 도구 객체
export const AmplitudeTool: AgentTool = {
  name: "get_amplitude_event",
  declaration: {
    name: "get_amplitude_event",
    description: "사용자 행동(클릭, 전환, 이벤트) 분석 도구. (소스: Amplitude)",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        start: { type: SchemaType.STRING, description: "YYYYMMDD" },
        end: { type: SchemaType.STRING, description: "YYYYMMDD" },
        event: { type: SchemaType.STRING },
        groupBy: { type: SchemaType.STRING },
      },
      required: ["start", "end", "event"],
    },
  },
  execute: async (args, keys) => {
    if (!keys.amplitudeApiKey || !keys.amplitudeSecretKey) {
      return "ERROR: AMPLITUDE_KEY_MISSING. (API Key 설정이 필요합니다.)";
    }
    return await fetchAmplitudeData(
      keys.amplitudeApiKey,
      keys.amplitudeSecretKey,
      args
    );
  },
};

export const StripeTool: AgentTool = {
  name: "get_stripe_report",
  declaration: {
    name: "get_stripe_report",
    description:
      "Get financial data report including Total Revenue, Payment Success/Failure rates from Stripe.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: {
          type: SchemaType.STRING,
          description: "Start date in YYYY-MM-DD format (e.g., '2024-01-01').",
        },
        endDate: {
          type: SchemaType.STRING,
          description: "End date in YYYY-MM-DD format (e.g., '2024-01-31').",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  execute: async (args: any, apiKeys: any) => {
    if (!apiKeys.stripeSecretKey) {
      return "Error: Stripe Secret Key is missing. Please ask user to provide it.";
    }
    // 상대 날짜(30daysAgo)를 받으면 변환하는 로직이 필요할 수 있으나,
    // Agent가 YYYY-MM-DD로 주도록 유도하거나 여기서 간단히 처리
    return await fetchStripeData(
      args.startDate,
      args.endDate,
      apiKeys.stripeSecretKey
    );
  },
};

export const SentryTool: AgentTool = {
  name: "get_sentry_issues",
  declaration: {
    name: "get_sentry_issues",
    description:
      "Get a list of recent unresolved technical errors and bugs from Sentry.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        days: {
          type: SchemaType.NUMBER,
          description: "Lookback period in days (default: 14)",
        },
      },
      required: [],
    },
  },
  execute: async (args: any, apiKeys: any) => {
    if (
      !apiKeys.sentryAuthToken ||
      !apiKeys.sentryOrg ||
      !apiKeys.sentryProject
    ) {
      return "Error: Sentry configuration missing. Please provide Auth Token, Org Slug, and Project Slug.";
    }
    // days가 없으면 기본값 14
    return await fetchSentryIssues(
      apiKeys.sentryAuthToken,
      apiKeys.sentryOrg,
      apiKeys.sentryProject,
      args.days || 14
    );
  },
};
