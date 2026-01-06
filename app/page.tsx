"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";
import { getGa4Properties, type Ga4Property } from "@/app/actions/ga4-admin";
import { getGscSites, type GscSite } from "@/app/actions/gsc-admin";
import { ANALYTICS_TOOLS } from "@/app/constants/tools-config";

function AnalyticsForm() {
  const router = useRouter();
  const { data: session } = useSession();

  // 1. [구조 개선] 툴을 연결 방식(OAuth/ApiKey)에 따라 동적으로 분류
  const oauthTools = ANALYTICS_TOOLS.filter(
    (t) => t.connectionType === "oauth"
  );
  const apiKeyTools = ANALYTICS_TOOLS.filter(
    (t) => t.connectionType === "apikey"
  );

  // 초기값 로드
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

  const [ga4Properties, setGa4Properties] = useState<Ga4Property[]>([]);
  const [gscSites, setGscSites] = useState<GscSite[]>([]);
  const [isLoadingProps, setIsLoadingProps] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 실시간 유효성 검사: 입력된 키가 하나라도 있는지 확인
  const hasValidCredentials = Object.values(credentials).some(
    (val) => val && val.trim().length > 0
  );

  // 로그인 시 GA4 & GSC 목록 동시 로드
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
    } catch (e) {
      console.error(e);
      setLoadError("목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingProps(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const handleStartChat = () => {
    if (!hasValidCredentials) {
      alert("최소 하나의 분석 도구는 연결해야 합니다.");
      return;
    }
    Object.entries(credentials).forEach(([key, value]) => {
      if (value.trim()) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    });
    router.push(`/chat`);
  };

  // 2. [구조 개선] OAuth 툴(GA4, GSC)별 렌더링 로직 분리
  const renderOAuthToolUI = (tool: (typeof ANALYTICS_TOOLS)[0]) => {
    if (tool.id === "ga4") {
      return (
        <div key={tool.id}>
          <label className="block text-xs font-bold text-orange-600 mb-1">
            📊 {tool.name}
          </label>
          {isLoadingProps ? (
            <div className="p-2.5 text-sm text-gray-400 bg-gray-100 rounded-lg animate-pulse">
              목록을 불러오는 중...
            </div>
          ) : (
            <select
              className="w-full border border-gray-300 bg-white p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              value={credentials["ga4PropertyId"] || ""}
              onChange={(e) =>
                handleInputChange("ga4PropertyId", e.target.value)
              }
            >
              <option value="">분석할 GA4 속성 선택</option>
              {ga4Properties.map((p) => (
                <option key={p.numericId} value={p.numericId}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}
        </div>
      );
    }

    if (tool.id === "gsc") {
      return (
        <div key={tool.id}>
          <label className="block text-xs font-bold text-teal-600 mb-1">
            🔍 {tool.name}
          </label>
          {isLoadingProps ? (
            <div className="p-2.5 text-sm text-gray-400 bg-gray-100 rounded-lg animate-pulse">
              목록을 불러오는 중...
            </div>
          ) : (
            <select
              className="w-full border border-gray-300 bg-white p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              value={credentials["gscSiteUrl"] || ""}
              onChange={(e) => handleInputChange("gscSiteUrl", e.target.value)}
            >
              <option value="">분석할 사이트 URL 선택</option>
              {gscSites.map((site) => (
                <option key={site.siteUrl} value={site.siteUrl}>
                  {site.siteUrl} ({site.permissionLevel})
                </option>
              ))}
            </select>
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

        {/* 1. Google 계정 연동 (OAuth Tools) */}
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

            {apiKeyTools.map((tool) => (
              <div
                key={tool.id}
                className={`p-5 border border-gray-200 rounded-xl bg-${tool.themeColor}-50/30 hover:border-${tool.themeColor}-200 transition-all`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{tool.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{tool.name}</h3>
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
                        className={`w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-${tool.themeColor}-500 outline-none transition-all text-gray-900`}
                        type={input.type}
                        placeholder={input.placeholder}
                        value={credentials[input.key] || ""}
                        onChange={(e) =>
                          handleInputChange(input.key, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleStartChat}
          disabled={!hasValidCredentials} // 활성화 상태에 따라 disabled 설정
          className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transform transition-all flex items-center justify-center gap-2 ${
            hasValidCredentials
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
