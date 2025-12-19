"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ANALYTICS_TOOLS } from "./constants/tools-config";

export default function Home() {
  const router = useRouter();

  // 1. 하이드레이션 불일치 방지용 (Client Mount 체크)
  const [mounted, setMounted] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  // 2. 마운트 된 후에만 localStorage 접근 (useEffect 경고 해결)
  useEffect(() => {
    setMounted(true);

    const savedCreds: Record<string, string> = {};
    ANALYTICS_TOOLS.forEach((tool) => {
      tool.inputs.forEach((input) => {
        const val = localStorage.getItem(input.key);
        if (val) savedCreds[input.key] = val;
      });
    });
    setCredentials(savedCreds);
  }, []);

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

    // 3. [ID 제거] 깔끔하게 /chat 경로로 이동
    router.push("/chat");
  };

  // 서버 사이드 렌더링 중에는 아무것도 안 보여줌 (UI 깨짐 방지)
  if (!mounted) return null;

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
