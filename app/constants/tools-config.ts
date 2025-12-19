export interface ToolInput {
  key: string; // 저장될 키 이름 (백엔드와 일치해야 함)
  label: string; // 사용자에게 보일 이름
  type: "text" | "password";
  placeholder: string;
}

export interface AnalyticsToolUI {
  id: string; // 툴 식별자
  name: string; // 툴 이름
  description: string;
  icon: string; // 이모지
  themeColor: string; // 배경색 스타일 (Tailwind class prefix)
  inputs: ToolInput[];
  docsUrl?: string; // 키 발급 방법 링크
}

// 🛠️ 여기에 툴을 추가하면 UI가 자동으로 생성됩니다.
export const ANALYTICS_TOOLS: AnalyticsToolUI[] = [
  {
    id: "ga4",
    name: "Google Analytics 4",
    description: "트래픽, 방문자, 유입 경로 분석",
    icon: "📊",
    themeColor: "orange",
    inputs: [
      {
        key: "ga4PropertyId",
        label: "Property ID",
        type: "text",
        placeholder: "예: 384728192",
      },
    ],
  },
  {
    id: "amplitude",
    name: "Amplitude",
    description: "사용자 행동, 전환율, 리텐션 분석",
    icon: "📈",
    themeColor: "blue",
    inputs: [
      {
        key: "amplitudeApiKey",
        label: "API Key",
        type: "password",
        placeholder: "API Key 입력",
      },
      {
        key: "amplitudeSecretKey",
        label: "Secret Key",
        type: "password",
        placeholder: "Secret Key 입력",
      },
    ],
    docsUrl: "https://app.amplitude.com/analytics/Settings/Projects",
  },
  // 예시: 믹스패널 추가 시 주석 해제만 하면 됨
  /*
  {
    id: "mixpanel",
    name: "Mixpanel",
    description: "이벤트 기반 프로덕트 분석",
    icon: "🟣",
    themeColor: "purple",
    inputs: [
      { key: "mixpanelToken", label: "Project Token", type: "text", placeholder: "Token 입력" }
    ]
  }
  */
];
