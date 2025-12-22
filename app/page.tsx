"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";
import { getGa4Properties, type Ga4Property } from "@/app/actions/ga4-admin";
import { ANALYTICS_TOOLS } from "@/app/constants/tools-config";

function AnalyticsForm() {
  const router = useRouter();
  const { data: session } = useSession();

  // 1. 초기값 로드
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
  const [isLoadingProps, setIsLoadingProps] = useState(false);
  const [ga4LoadError, setGa4LoadError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.accessToken) {
      loadProperties(session.accessToken);
    }
  }, [session]);

  // 설정 파일에서 각 툴의 설정을 미리 찾아서 변수에 할당 (렌더링 시 사용)
  const ga4Config = ANALYTICS_TOOLS.find((t) => t.id === "ga4");
  const amplitudeConfig = ANALYTICS_TOOLS.find((t) => t.id === "amplitude");
  const stripeConfig = ANALYTICS_TOOLS.find((t) => t.id === "stripe");

  const loadProperties = async (token: string) => {
    setIsLoadingProps(true);
    setGa4LoadError(null); // 에러 초기화
    try {
      const props = await getGa4Properties(token);
      if (!props || props.length === 0) {
        setGa4LoadError("접근 가능한 속성이 없습니다.");
      }
      setGa4Properties(props || []);
    } catch (e) {
      console.error(e);
      setGa4LoadError("목록을 불러오지 못했습니다.");
    } finally {
      setIsLoadingProps(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const handleStartChat = () => {
    const hasAnyKey = Object.values(credentials).some(
      (val) => val.trim() !== ""
    );

    if (!hasAnyKey) {
      alert("최소 하나의 분석 도구는 연결해야 합니다.");
      return;
    }

    Object.entries(credentials).forEach(([key, value]) => {
      if (value.trim()) {
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
      }
    });

    router.push(`/chat`);
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

        <div className="space-y-6">
          {/* 🟢 1. GA4 섹션 */}
          {ga4Config && (
            <div
              className={`p-5 border border-gray-200 rounded-xl bg-${ga4Config.themeColor}-50/30 hover:border-${ga4Config.themeColor}-200 transition-all`}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{ga4Config.icon}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{ga4Config.name}</h3>
                  <p className="text-xs text-gray-500">
                    {ga4Config.description}
                  </p>
                </div>
                {session ? (
                  <button
                    onClick={() => signOut()}
                    className="text-xs text-red-500 underline"
                  >
                    연동 해제
                  </button>
                ) : null}
              </div>

              <div className="space-y-3">
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
                    Google 계정으로 연동하기
                  </button>
                ) : (
                  <div>
                    {/* GA4 설정의 첫 번째 input(ga4PropertyId) 라벨 사용 */}
                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">
                      {ga4Config.inputs[0].label}
                    </label>
                    {isLoadingProps ? (
                      <div className="p-3 text-sm text-gray-400 bg-gray-100 rounded-lg animate-pulse">
                        목록을 불러오는 중...
                      </div>
                    ) : ga4Properties.length > 0 ? (
                      <select
                        className={`w-full border border-${ga4Config.themeColor}-300 bg-white p-3 rounded-lg focus:ring-2 focus:ring-${ga4Config.themeColor}-500 outline-none text-gray-900`}
                        value={credentials["ga4PropertyId"] || ""}
                        onChange={(e) =>
                          handleInputChange("ga4PropertyId", e.target.value)
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
                      <div className="flex flex-col gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                        <div className="text-sm text-red-500">
                          {ga4LoadError || "접근 가능한 GA4 속성이 없습니다."}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              session.accessToken &&
                              loadProperties(session.accessToken)
                            }
                            className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 text-gray-700"
                          >
                            ↻ 다시 시도
                          </button>
                          <button
                            onClick={() => signIn("google")}
                            className="text-xs bg-orange-100 text-orange-800 border border-orange-200 px-3 py-1.5 rounded hover:bg-orange-200"
                          >
                            🔑 토큰 갱신 (재로그인)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 🔵 2. Amplitude 섹션 */}
          {amplitudeConfig && (
            <div
              className={`p-5 border border-gray-200 rounded-xl bg-${amplitudeConfig.themeColor}-50/30 hover:border-${amplitudeConfig.themeColor}-200 transition-all`}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{amplitudeConfig.icon}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">
                    {amplitudeConfig.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {amplitudeConfig.description}
                  </p>
                </div>
                {amplitudeConfig.docsUrl && (
                  <a
                    href={amplitudeConfig.docsUrl}
                    target="_blank"
                    className={`text-xs text-${amplitudeConfig.themeColor}-500 hover:underline`}
                  >
                    {amplitudeConfig.docsLabel || "키 확인하기 ↗"}
                  </a>
                )}
              </div>

              <div className="space-y-3">
                {amplitudeConfig.inputs.map((input) => (
                  <div key={input.key}>
                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">
                      {input.label}
                    </label>
                    <input
                      className={`w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-${amplitudeConfig.themeColor}-500 outline-none transition-all text-sm text-gray-900`}
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
          )}

          {/* 🟣 3. Stripe 섹션 */}
          {stripeConfig && (
            <div
              className={`p-5 border border-gray-200 rounded-xl bg-${stripeConfig.themeColor}-50/30 hover:border-${stripeConfig.themeColor}-200 transition-all`}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{stripeConfig.icon}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">
                    {stripeConfig.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {stripeConfig.description}
                  </p>
                </div>
                {stripeConfig.docsUrl && (
                  <a
                    href={stripeConfig.docsUrl}
                    target="_blank"
                    className={`text-xs text-${stripeConfig.themeColor}-600 hover:underline font-medium`}
                  >
                    {stripeConfig.docsLabel || "키 발급 바로가기 ↗"}
                  </a>
                )}
              </div>

              <div className="space-y-3">
                {stripeConfig.inputs.map((input) => (
                  <div key={input.key}>
                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">
                      {input.label}
                    </label>
                    <input
                      className={`w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-${stripeConfig.themeColor}-500 outline-none transition-all text-sm text-gray-900`}
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
          )}
        </div>

        <button
          onClick={handleStartChat}
          className="w-full bg-black hover:bg-gray-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg transform active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <span>분석 시작하기 🚀</span>
        </button>
      </div>
    </div>
  );
}

const DynamicHome = dynamic(() => Promise.resolve(AnalyticsForm), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      로딩 중...
    </div>
  ),
});

export default DynamicHome;
