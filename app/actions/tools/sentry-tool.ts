"use server";

export async function fetchSentryIssues(
  authToken: string,
  orgSlug: string,
  projectSlug: string,
  days: number = 14 // 기본 2주치 조회
) {
  if (!authToken || !orgSlug || !projectSlug) {
    throw new Error("Sentry 연결 정보(Token, Org, Project)가 부족합니다.");
  }

  // 1. 최근 이슈 목록 조회 (Unresolved Issues)
  // statsPeriod=14d (최근 14일)
  const issuesUrl = `https://sentry.io/api/0/projects/${orgSlug}/${projectSlug}/issues/?query=is:unresolved&statsPeriod=${days}d&limit=10`;

  try {
    const response = await fetch(issuesUrl, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sentry API Error: ${response.status} ${errorText}`);
    }

    const issues = await response.json();

    if (!Array.isArray(issues) || issues.length === 0) {
      return "✅ No unresolved issues found in the last 14 days. System is healthy.";
    }

    // 2. AI를 위한 리포트 포맷팅
    let report = `[Sentry Error Report: Last ${days} Days]\n`;
    report += `Error Type | Message | Count | Last Seen | Level\n`;
    report += `---|---|---|---|---\n`;

    issues.forEach((issue: any) => {
      // 제목이 너무 길면 자르기
      const title = issue.title.replace(/[\r\n]/g, " ").substring(0, 30);
      const message = (issue.culprit || "").substring(0, 40);
      
      report += `${title} | ${message} | ${issue.count} | ${new Date(issue.lastSeen).toISOString().split('T')[0]} | ${issue.level}\n`;
    });

    report += `\n(Tip: 'count'가 높거나 'level'이 'fatal'인 이슈는 즉시 해결해야 합니다.)`;

    return report;

  } catch (error: any) {
    // Sentry는 권한 에러가 잦으므로 힌트 제공
    if (error.message.includes("401") || error.message.includes("403")) {
      return "ERROR: Sentry 권한 거부. Auth Token에 'project:read', 'event:read', 'org:read' 권한이 있는지 확인하세요.";
    }
    return `Error fetching Sentry data: ${error.message}`;
  }
}
```

---

### 3단계: 도구 등록 (`app/actions/tools/definitions.ts`)

Stripe 도구 밑에 Sentry 도구도 등록합니다.

```typescript
// ... imports
import { fetchSentryIssues } from "./sentry-tool"; // 추가

// ...

export const SentryTool: AgentTool = {
  name: "get_sentry_issues",
  declaration: {
    name: "get_sentry_issues",
    description: "Get a list of recent unresolved technical errors and bugs from Sentry.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        days: { 
          type: SchemaType.NUMBER, 
          description: "Lookback period in days (default: 14)" 
        },
      },
      required: [],
    },
  },
  execute: async (args: any, apiKeys: any) => {
    if (!apiKeys.sentryAuthToken || !apiKeys.sentryOrg || !apiKeys.sentryProject) {
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