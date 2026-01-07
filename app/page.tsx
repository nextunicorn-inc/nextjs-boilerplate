"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";
import { getGa4Properties, type Ga4Property } from "@/app/actions/ga4-admin";
import { getGscSites, type GscSite } from "@/app/actions/gsc-admin";
import { validateAmplitude } from "@/app/actions/tools/validate-tools"; // 검증 함수 import
import { ANALYTICS_TOOLS } from "@/app/constants/tools-config";

// 검증 상태 타입
type ValidationState = "idle" | "validating" | "success" | "error";

function AnalyticsForm() {
  const router = useRouter();
  const { data: session } = useSession();

  const oauthTools = ANALYTICS_TOOLS.filter(
    (t) => t.connectionType === "oauth"
  );
  const apiKeyTools = ANALYTICS_TOOLS.filter(
    (t) => t.connectionType === "apikey"
  );

  const [credentials, setCredentials] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    const saved: Record<string, string> = {};
    ANALYTICS_TOOLS.forEach((tool) => {
      tool.inputs.forEach((input) => {
        const val = localStorage.getItem(input.key);
        if (val) saved[input.key] = val;
      });
    });
    return saved;
  });

  // 툴별 검증 상태 관리
  const [validationStatus, setValidationStatus] = useState<
    Record<string, ValidationState>
  >({});

  const [ga4Properties, setGa4Properties] = useState<Ga4Property[]>([]);
  const [gscSites, setGscSites] = useState<GscSite[]>([]);
  const [isLoadingProps, setIsLoadingProps] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 구글 로그인 데이터 로드 (OAuth 툴 검증 로직 포함)
  useEffect(() => {
    if (session?.accessToken) {
      loadGoogleData(session.accessToken);
    }
  }, [session]);

  const loadGoogleData = async (token: string) => {
    setIsLoadingProps(true);
    setLoadError(null);
    try {
      const [ga4Data, gscData] = await Promise.all([
        getGa4Properties(token),
        getGscSites(token),
      ]);

      setGa4Properties(ga4Data || []);
      setGscSites(gscData || []);

      // 데이터가 정상적으로 로드되면 OAuth 툴들은 '연동 성공'으로 간주
      setValidationStatus((prev) => ({
        ...prev,
        ga4: ga4Data.length > 0 ? "success" : "idle",
        gsc: gscData.length > 0 ? "success" : "idle",
      }));
    } catch (e) {
      console.error(e);
      setLoadError("목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingProps(false);
    }
  };

  const handleInputChange = (toolId: string, key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));

    // 입력값이 바뀌면 검증 상태를 초기화 (API Key 툴만 해당)
    // OAuth 툴은 드롭다운 선택이므로 제외
    const tool = apiKeyTools.find((t) => t.id === toolId);
    if (tool) {
      setValidationStatus((prev) => ({ ...prev, [toolId]: "idle" }));
    }
  };

  // 🟢 [핵심] API Key 연동 확인 핸들러
  const handleValidateTool = async (toolId: string) => {
    const tool = ANALYTICS_TOOLS.find((t) => t.id === toolId);
    if (!tool) return;

    // 필수 입력값 확인
    const inputsFilled = tool.inputs.every((input) =>
      credentials[input.key]?.trim()
    );

    if (!inputsFilled) {
      return;
    }

    setValidationStatus((prev) => ({ ...prev, [toolId]: "validating" }));

    let isValid = false;

    // 도구별 검증 로직 분기
    if (toolId === "amplitude") {
      const result = await validateAmplitude(
        credentials["amplitudeApiKey"],
        credentials["amplitudeSecretKey"]
      );
      isValid = result.success;
    }
    // 추후 Stripe, Sentry 등 추가 시 여기에 else if 추가

    setValidationStatus((prev) => ({
      ...prev,
      [toolId]: isValid ? "success" : "error",
    }));
  };

  // 🚦 버튼 활성화 조건: 하나라도 'success' 상태여야 함
  const canStart = Object.values(validationStatus).some(
    (status) => status === "success"
  );

  const handleStartChat = () => {
    if (!canStart) return;

    Object.entries(credentials).forEach(([key, value]) => {
      if (value.trim()) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    });
    router.push(`/chat`);
  };

  const renderOAuthToolUI = (tool: (typeof ANALYTICS_TOOLS)[0]) => {
    // OAuth 툴은 목록이 로드되고 선택값이 있으면 연동된 것으로 간주
    const isConnected =
      validationStatus[tool.id] === "success" &&
      (tool.id === "ga4"
        ? credentials["ga4PropertyId"]
        : credentials["gscSiteUrl"]);

    if (tool.id === "ga4") {
      return (
        <div key={tool.id}>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-orange-600">
              📊 {tool.name}
            </label>
            {isConnected && (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                연동됨
              </span>
            )}
          </div>
          {isLoadingProps ? (
            <div className="p-2.5 text-sm text-gray-400 bg-gray-100 rounded-lg animate-pulse">
              목록을 불러오는 중...
            </div>
          ) : ga4Properties.length > 0 ? (
            <select
              className={`w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none ${
                isConnected
                  ? "border-green-500 bg-green-50/30"
                  : "border-gray-300 bg-white"
              }`}
              value={credentials["ga4PropertyId"] || ""}
              onChange={(e) =>
                handleInputChange("ga4", "ga4PropertyId", e.target.value)
              }
            >
              <option value="">속성을 선택해주세요</option>
              {ga4Properties.map((p) => (
                <option key={p.numericId} value={p.numericId}>
                  {p.displayName} ({p.numericId})
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-red-500 p-2">
              {loadError || "접근 가능한 속성이 없습니다."}
            </div>
          )}
        </div>
      );
    }

    if (tool.id === "gsc") {
      return (
        <div key={tool.id}>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-teal-600">
              🔍 {tool.name}
            </label>
            {isConnected && (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                연동됨
              </span>
            )}
          </div>
          {isLoadingProps ? (
            <div className="p-2.5 text-sm text-gray-400 bg-gray-100 rounded-lg animate-pulse">
              목록을 불러오는 중...
            </div>
          ) : gscSites.length > 0 ? (
            <select
              className={`w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none ${
                isConnected
                  ? "border-green-500 bg-green-50/30"
                  : "border-gray-300 bg-white"
              }`}
              value={credentials["gscSiteUrl"] || ""}
              onChange={(e) =>
                handleInputChange("gsc", "gscSiteUrl", e.target.value)
              }
            >
              <option value="">사이트를 선택해주세요</option>
              {gscSites.map((s) => (
                <option key={s.siteUrl} value={s.siteUrl}>
                  {s.siteUrl} ({s.permissionLevel})
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-red-500 p-2">
              {loadError || "접근 가능한 사이트가 없습니다."}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white p-8 rounded-2xl shadow-xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">
            🤖 통합 데이터 분석 AI
          </h1>
          <p className="mt-2 text-gray-500">
            데이터 소스를 연동하면 AI가 분석을 시작합니다.
          </p>
        </div>

        {/* 1. Google 계정 연동 */}
        {oauthTools.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
              Easy Connect (Google)
            </h2>
            <div className="p-5 border border-gray-200 rounded-xl bg-gray-50/50">
              {!session ? (
                <button
                  onClick={() => signIn("google")}
                  className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
                >
                  <img
                    src="https://www.svgrepo.com/show/475656/google-color.svg"
                    className="w-5 h-5"
                    alt="google"
                  />
                  Google 계정으로 연동하기 (GA4 + Search Console)
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-sm font-medium text-gray-700">
                      ✅ Google 계정 연동됨
                    </span>
                    <button
                      onClick={() => signOut()}
                      className="text-xs text-red-500 underline"
                    >
                      연동 해제
                    </button>
                  </div>
                  {oauthTools.map((tool) => renderOAuthToolUI(tool))}
                  {loadError && (
                    <div className="text-xs text-red-500 flex gap-2 items-center">
                      <span>{loadError}</span>
                      <button
                        onClick={() =>
                          session.accessToken &&
                          loadGoogleData(session.accessToken)
                        }
                        className="underline"
                      >
                        다시 시도
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. 고급 연동 (API Key Tools) */}
        {apiKeyTools.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
              Advanced Connect (API Key)
            </h2>
            {apiKeyTools.map((tool) => {
              const status = validationStatus[tool.id] || "idle";
              const isConnected = status === "success";
              const isError = status === "error";
              const isValidating = status === "validating";

              // 필수 입력값이 다 채워졌는지 확인 (버튼 활성화 조건)
              const isReadyToValidate = tool.inputs.every((input) =>
                credentials[input.key]?.trim()
              );

              return (
                <div
                  key={tool.id}
                  className={`p-5 border rounded-xl transition-all bg-${
                    tool.themeColor
                  }-50/30 ${
                    isConnected
                      ? `border-${tool.themeColor}-500 shadow-sm`
                      : isError
                      ? "border-red-400"
                      : `border-gray-200 hover:border-${tool.themeColor}-200`
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{tool.icon}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <h3 className="font-bold text-gray-800">{tool.name}</h3>
                      {isConnected && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200">
                          연동됨
                        </span>
                      )}
                      {isError && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold border border-red-200">
                          실패
                        </span>
                      )}
                    </div>
                    {tool.docsUrl && (
                      <a
                        href={tool.docsUrl}
                        target="_blank"
                        className={`text-xs text-${tool.themeColor}-600 hover:underline font-medium`}
                      >
                        {tool.docsLabel || "키 확인 ↗"}
                      </a>
                    )}
                  </div>

                  <div className="space-y-3">
                    {tool.inputs.map((input) => (
                      <div key={input.key}>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">
                          {input.label}
                        </label>
                        <input
                          className={`w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-${
                            tool.themeColor
                          }-500 outline-none transition-all text-gray-900 ${
                            credentials[input.key]
                              ? "bg-white"
                              : "bg-white border-gray-300"
                          }`}
                          type={input.type}
                          placeholder={input.placeholder}
                          value={credentials[input.key] || ""}
                          onChange={(e) =>
                            handleInputChange(
                              tool.id,
                              input.key,
                              e.target.value
                            )
                          }
                        />
                      </div>
                    ))}

                    {/* 연동 확인 버튼 */}
                    {!isConnected && (
                      <div className="pt-2 text-right">
                        <button
                          onClick={() => handleValidateTool(tool.id)}
                          disabled={!isReadyToValidate || isValidating}
                          className={`text-xs px-4 py-2 rounded-lg font-medium transition-all ${
                            isReadyToValidate
                              ? `bg-${tool.themeColor}-600 text-white hover:bg-${tool.themeColor}-700 shadow-sm`
                              : "bg-gray-200 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {isValidating ? "확인 중..." : "연동 확인"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={handleStartChat}
          disabled={!canStart}
          className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transform transition-all flex items-center justify-center gap-2 ${
            canStart
              ? "bg-black hover:bg-gray-800 text-white active:scale-[0.99]"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          <span>분석 시작하기 🚀</span>
        </button>
      </div>
    </div>
  );
}

const DynamicHome = dynamic(() => Promise.resolve(AnalyticsForm), {
  ssr: false,
});
export default DynamicHome;
