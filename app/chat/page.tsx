"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic"; // 1. dynamic import
import { chatWithGemini } from "@/app/actions/gemini-agent";
import { ANALYTICS_TOOLS } from "@/app/constants/tools-config";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 2. 실제 채팅 로직이 담긴 컴포넌트
// ssr: false 덕분에 브라우저 환경임이 100% 보장됩니다.
function ChatInterface() {
  const { data: session } = useSession();

  // 3. [핵심] useState 초기값에서 바로 localStorage 접근 (useEffect 불필요)
  // 서버 렌더링을 안 하므로 Hydration Error 걱정 없이 바로 읽으면 됩니다.
  const [activeTools] = useState<Record<string, boolean>>(() => {
    const status: Record<string, boolean> = {};
    ANALYTICS_TOOLS.forEach((tool) => {
      // 해당 툴의 첫 번째 키가 저장되어 있으면 활성 상태로 간주
      status[tool.id] = !!localStorage.getItem(tool.inputs[0].key);
    });
    return status;
  });

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);

  // 스크롤 처리를 위한 Ref
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // GA4 로그인 체크 (localStorage 바로 접근 가능)
    const hasGa4Property = localStorage.getItem("ga4PropertyId");
    if (hasGa4Property && !session?.accessToken) {
      // 필요하다면 여기서 로그인 경고 처리
      // alert("GA4 분석을 위해 구글 로그인을 확인해주세요.");
    }

    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    // 4. 전송 시점에도 동적으로 키 수집
    const apiKeys: Record<string, string | undefined> = {
      ga4AccessToken: session?.accessToken,
      gscAccessToken: session?.accessToken, // GSC도 구글 토큰 공유
    };

    // 나머지 키는 로컬 스토리지에서 자동 매핑 (tools-config 기반)
    ANALYTICS_TOOLS.forEach((tool) => {
      tool.inputs.forEach((input) => {
        const val = localStorage.getItem(input.key);
        if (val) apiKeys[input.key] = val;
      });
    });

    try {
      const aiResponse = await chatWithGemini(userMsg, apiKeys);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiResponse },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "에러가 발생했습니다." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 h-screen flex flex-col bg-gray-50">
      <header className="mb-4 text-center">
        <h1 className="text-2xl font-bold">🤖 AI Data Analyst</h1>

        {/* 연결된 툴 배지 표시 (activeTools 상태 기반) */}
        <div className="flex justify-center flex-wrap gap-2 mt-2 text-xs">
          {ANALYTICS_TOOLS.map((tool) => {
            const isActive = activeTools[tool.id];
            return (
              <span
                key={tool.id}
                className={`px-2 py-1 rounded transition-colors ${
                  isActive
                    ? `bg-${tool.themeColor}-100 text-${tool.themeColor}-700 font-bold border border-${tool.themeColor}-200`
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {tool.name} {isActive ? "ON" : "OFF"}
              </span>
            );
          })}
        </div>
      </header>

      {/* 채팅 메시지 영역 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 border rounded-xl bg-white shadow-sm">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20 space-y-2">
            <p>데이터 분석 준비 완료!</p>
            <p className="text-sm">"지난달 트래픽 요약해줘"</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`p-4 rounded-2xl max-w-[90%] shadow-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-white text-gray-900 rounded-bl-none border border-gray-200" // 흰색 배경 추천
              }`}
            >
              {/* 👇 그냥 {m.content} 대신 아래처럼 작성 */}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // 스타일 커스터마이징 (Tailwind 사용)
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4 border rounded-lg">
                      <table
                        className="min-w-full divide-y divide-gray-200"
                        {...props}
                      />
                    </div>
                  ),
                  thead: ({ node, ...props }) => (
                    <thead className="bg-gray-50" {...props} />
                  ),
                  th: ({ node, ...props }) => (
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      {...props}
                    />
                  ),
                  td: ({ node, ...props }) => (
                    <td
                      className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 border-t"
                      {...props}
                    />
                  ),
                  h1: ({ node, ...props }) => (
                    <h1 className="text-2xl font-bold my-4" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2
                      className="text-xl font-bold my-3 text-blue-800"
                      {...props}
                    />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="text-lg font-bold my-2" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul
                      className="list-disc list-inside my-2 space-y-1"
                      {...props}
                    />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong className="font-bold text-indigo-600" {...props} />
                  ),
                }}
              >
                {m.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-4 rounded-2xl rounded-bl-none flex items-center gap-2">
              <span className="text-sm text-gray-500 animate-pulse">
                데이터를 분석하고 있습니다...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 영역 */}
      <div className="flex gap-3 items-end">
        <textarea
          className="flex-1 border border-gray-300 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm resize-none text-gray-900 placeholder-gray-400"
          rows={1}
          style={{ minHeight: "60px", maxHeight: "200px" }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문하세요 (Shift+Enter 줄바꿈)"
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-[60px] rounded-xl font-bold shadow-sm transition-all disabled:bg-gray-400 flex items-center justify-center shrink-0"
        >
          전송
        </button>
      </div>
    </div>
  );
}

// 5. [Dynamic Export]
// Promise.resolve로 컴포넌트를 감싸서 파일 분리 없이 CSR 전용으로 만듭니다.
const DynamicChatPage = dynamic(() => Promise.resolve(ChatInterface), {
  ssr: false,
  loading: () => (
    <div className="p-10 text-center text-gray-500">로딩 중...</div>
  ),
});

export default DynamicChatPage;
