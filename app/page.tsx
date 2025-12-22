"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react"; // next-auth 추가
import dynamic from "next/dynamic";
import { getGa4Properties, type Ga4Property } from "@/app/actions/ga4-admin"; // 위에서 만든 액션
import { ANALYTICS_TOOLS } from "@/app/constants/tools-config";

function AnalyticsForm() {
  const router = useRouter();
  const { data: session } = useSession(); // 세션(로그인 정보) 가져오기

  // 저장된 자격증명
  const [credentials, setCredentials] = useState<Record<string, string>>(() => {
    const saved: Record<string, string> = {};
    ANALYTICS_TOOLS.forEach((tool) => {
      tool.inputs.forEach((input) => {
        const val = localStorage.getItem(input.key);
        if (val) saved[input.key] = val;
      });
    });
    return saved;
  });

  // GA4 프로퍼티 목록 상태
  const [ga4Properties, setGa4Properties] = useState<Ga4Property[]>([]);
  const [isLoadingProps, setIsLoadingProps] = useState(false);

  // 1. 구글 로그인 되면 자동으로 프로퍼티 목록 가져오기
  useEffect(() => {
    if (session?.accessToken) {
      loadProperties(session.accessToken);
    }
  }, [session]);

  const loadProperties = async (token: string) => {
    setIsLoadingProps(true);
    const props = await getGa4Properties(token);
    setGa4Properties(props);
    setIsLoadingProps(false);
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
      if (value.trim()) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    });

    router.push("/chat");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white p-8 rounded-2xl shadow-xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">
            🤖 AI Data Analyst
          </h1>
          <p className="mt-2 text-gray-500">
            데이터 소스를 연동하면 AI가 분석을 시작합니다.
          </p>
        </div>

        <div className="space-y-6">
          {/* 🟢 1. GA4 섹션 (완전히 개편됨) */}
          <div className="p-5 border border-gray-200 rounded-xl bg-orange-50/30 hover:border-orange-200 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📊</span>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">Google Analytics 4</h3>
                <p className="text-xs text-gray-500">트래픽, 방문자 분석</p>
              </div>
              {/* 로그인 상태 표시 */}
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
                // 1-1. 비로그인 상태: 로그인 버튼 표시
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
                // 1-2. 로그인 상태: 프로퍼티 선택 드롭다운
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">
                    분석할 속성(Property) 선택
                  </label>
                  {isLoadingProps ? (
                    <div className="p-3 text-sm text-gray-400 bg-gray-100 rounded-lg animate-pulse">
                      목록을 불러오는 중...
                    </div>
                  ) : ga4Properties.length > 0 ? (
                    <select
                      className="w-full border border-orange-300 bg-white p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-gray-900"
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
                    <div className="text-sm text-red-500 p-2">
                      접근 가능한 GA4 속성이 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 🔵 2. Amplitude 섹션 (직접 입력 유지) */}
          <div className="p-5 border border-gray-200 rounded-xl bg-blue-50/30 hover:border-blue-200 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📈</span>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">Amplitude</h3>
                <p className="text-xs text-gray-500">행동, 이벤트 분석</p>
              </div>
              <a
                href="https://app.amplitude.com/analytics/settings/projects"
                target="_blank"
                className="text-xs text-blue-500 hover:underline"
              >
                키 확인하기 ↗
              </a>
            </div>

            <div className="space-y-3">
              {/* 앰플리튜드는 API 구조상 키 직접 입력이 필수입니다 */}
              <input
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-900"
                type="password"
                placeholder="API Key 입력"
                value={
                  credentials["amplitudeApiKey"] ||
                  "c962deb572754a3cccc44f706e41eff5"
                }
                onChange={(e) =>
                  handleInputChange("amplitudeApiKey", e.target.value)
                }
              />
              <input
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-900"
                type="password"
                placeholder="Secret Key 입력"
                value={
                  credentials["amplitudeSecretKey"] ||
                  "ad1c968d2cce70e9345d412aa2025c7a"
                }
                onChange={(e) =>
                  handleInputChange("amplitudeSecretKey", e.target.value)
                }
              />
            </div>
          </div>

          {/* 🟣 3. Stripe 섹션 (신규 추가됨) */}
          <div className="p-5 border border-gray-200 rounded-xl bg-violet-50/30 hover:border-violet-200 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">💳</span>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">Stripe</h3>
                <p className="text-xs text-gray-500">매출, 결제 실패율 분석</p>
              </div>
              {/* 👇 마법의 링크: 클릭 시 읽기 권한만 체크된 키 생성 화면으로 이동 */}
              <a
                href="https://dashboard.stripe.com/apikeys/create?name=MyAIDashboard&permissions[]=charges.read&permissions[]=subscriptions.read"
                target="_blank"
                className="text-xs text-violet-600 hover:underline font-medium"
              >
                키 발급 바로가기 ↗
              </a>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">
                  Secret Key (Restricted)
                </label>
                <input
                  className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm text-gray-900"
                  type="password"
                  placeholder="rk_live_... 또는 sk_live_..."
                  value={credentials["stripeSecretKey"] || ""}
                  onChange={(e) =>
                    handleInputChange("stripeSecretKey", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
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
