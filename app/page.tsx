"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic"; // 1. dynamic import 가져오기
import { ANALYTICS_TOOLS } from "./constants/tools-config";

// 2. 실제 로직이 담긴 컴포넌트 (이름은 자유, export 안 해도 됨)
// 이 컴포넌트는 'ssr: false' 덕분에 브라우저에서만 실행됨이 보장됩니다.
function AnalyticsForm() {
  const router = useRouter();

  // 3. [핵심] 브라우저 환경이 보장되므로, useEffect 없이 초기값에서 바로 localStorage 사용!
  // 더 이상 'window is not defined' 에러도, 'useEffect' 경고도 없습니다.
  const [credentials, setCredentials] = useState<Record<string, string>>(() => {
    const savedCreds: Record<string, string> = {};
    ANALYTICS_TOOLS.forEach((tool) => {
      tool.inputs.forEach((input) => {
        // 여기서 바로 접근 가능
        const val = localStorage.getItem(input.key);
        if (val) savedCreds[input.key] = val;
      });
    });
    return savedCreds;
  });

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

    router.push("/chat");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white p-8 rounded-2xl shadow-xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">
            🤖 통합 데이터 분석 AI
          </h1>
          <p className="mt-2 text-gray-500">
            API 키를 입력하면 AI가 연동하여 분석해 드립니다. <br />
            (키는 브라우저에만 저장됩니다)
          </p>
        </div>

        <div className="space-y-6">
          {ANALYTICS_TOOLS.map((tool) => (
            <div
              key={tool.id}
              className={`p-5 border border-gray-200 rounded-xl transition-all hover:shadow-md bg-${tool.themeColor}-50/30 hover:border-${tool.themeColor}-200`}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{tool.icon}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{tool.name}</h3>
                  <p className="text-xs text-gray-500">{tool.description}</p>
                </div>
                {tool.docsUrl && (
                  <a
                    href={tool.docsUrl}
                    target="_blank"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    키 확인 방법 ↗
                  </a>
                )}
              </div>

              <div className="space-y-3">
                {tool.inputs.map((input) => (
                  <div key={input.key}>
                    <input
                      className={`w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-${tool.themeColor}-500 outline-none transition-all text-sm text-gray-900`}
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

// 4. [마법의 코드] 위에서 만든 컴포넌트를 dynamic import로 감싸서 내보내기
// Promise.resolve를 사용하여 외부 파일 없이도 dynamic import 효과를 냅니다.
const DynamicHome = dynamic(() => Promise.resolve(AnalyticsForm), {
  ssr: false, // 서버 사이드 렌더링 끄기
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      로딩 중...
    </div>
  ),
});

export default DynamicHome;
