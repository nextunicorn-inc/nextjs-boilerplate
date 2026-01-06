export interface ToolInput {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder: string;
}

export interface AnalyticsToolUI {
  id: string;
  name: string;
  description: string;
  icon: string;
  themeColor: string;
  connectionType?: "oauth" | "apikey";
  docsUrl?: string;
  docsLabel?: string;
  inputs: ToolInput[];
}

export const ANALYTICS_TOOLS: AnalyticsToolUI[] = [
  {
    id: "ga4",
    name: "Google Analytics 4",
    description: "트래픽, 사용자 유입 분석",
    icon: "📊",
    themeColor: "orange",
    connectionType: "oauth",
    inputs: [
      {
        key: "ga4PropertyId",
        label: "속성 ID (Property ID)",
        type: "text",
        placeholder: "예: 123456789",
      },
    ],
  },
  // 👇 [추가] Google Search Console 설정
  {
    id: "gsc",
    name: "Google Search Console",
    description: "구글 검색어, 노출수, 클릭수, SEO 분석",
    icon: "🔍",
    themeColor: "teal", // 청록색 테마 추천
    connectionType: "oauth", // 구글 로그인 공유
    inputs: [
      {
        key: "gscSiteUrl",
        label: "사이트 URL",
        type: "text",
        placeholder: "https://...",
      },
    ],
  },
  {
    id: "amplitude",
    name: "Amplitude",
    description: "사용자 행동, 이벤트 분석",
    icon: "📈",
    themeColor: "blue",
    connectionType: "apikey",
    docsUrl: "https://app.amplitude.com/analytics/Settings/Projects",
    docsLabel: "키 확인하기 ↗",
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
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "매출, 결제 실패율 분석",
    icon: "💳",
    themeColor: "violet",
    connectionType: "apikey",
    docsUrl:
      "https://dashboard.stripe.com/apikeys/create?name=MyAIDashboard&permissions[]=charges.read&permissions[]=subscriptions.read",
    docsLabel: "키 발급 바로가기 ↗",
    inputs: [
      {
        key: "stripeSecretKey",
        label: "Secret Key (Restricted)",
        type: "password",
        placeholder: "sk_live_... 또는 rk_live_...",
      },
    ],
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "서버 에러, 버그, 기술적 이슈 분석",
    icon: "🚨",
    themeColor: "rose",
    connectionType: "apikey",
    docsUrl: "https://sentry.io/settings/account/api/auth-tokens/",
    docsLabel: "Auth Token 만들기 ↗",
    inputs: [
      {
        key: "sentryAuthToken",
        label: "Auth Token",
        type: "password",
        placeholder: "sntry_...",
      },
      {
        key: "sentryOrg",
        label: "Organization Slug",
        type: "text",
        placeholder: "예: my-company",
      },
      {
        key: "sentryProject",
        label: "Project Slug",
        type: "text",
        placeholder: "예: nextjs-project",
      },
    ],
  },
];
