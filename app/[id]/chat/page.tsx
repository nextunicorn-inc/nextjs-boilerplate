"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation"; // 1. useParams 추가
import { chatWithGemini } from "@/app/actions/gemini-agent";

export default function ChatPage() {
  const { data: session } = useSession();
  const params = useParams(); // 2. URL 파라미터 가져오기
  const propertyId = params.id as string; // URL의 [id] 부분이 여기 들어옵니다.

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!session?.accessToken) {
      alert("로그인이 필요합니다!");
      return;
    }

    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      // 3. URL에서 가져온 propertyId 사용
      const aiResponse = await chatWithGemini(
        userMsg,
        session.accessToken as string,
        propertyId
      );

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
        <h1 className="text-2xl font-bold">🤖 AI 애널리틱스</h1>
        {/* 현재 분석 중인 ID 표시 */}
        <p className="text-sm text-gray-500 mt-1">
          Target Property:{" "}
          <span className="font-mono bg-gray-200 px-1 rounded">
            {propertyId}
          </span>
        </p>
      </header>

      {/* ... (나머지 채팅 UI 코드는 기존과 동일) ... */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 border rounded-xl bg-white shadow-sm">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`p-4 rounded-2xl max-w-[80%] whitespace-pre-wrap leading-relaxed shadow-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-100 text-gray-800 rounded-bl-none"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-gray-500 text-sm p-4">AI가 분석 중입니다...</div>
        )}
      </div>

      <div className="flex gap-3">
        <input
          className="flex-1 border border-gray-300 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="데이터에 대해 물어보세요..."
          onKeyDown={(e) => {
            // 조합 중(한글 입력 중)이면 전송하지 않음
            if (e.nativeEvent.isComposing) return;

            if (e.key === "Enter") {
              e.preventDefault(); // 엔터 키의 기본 줄바꿈 동작 등 방지
              handleSend();
            }
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-blue-600 text-white px-8 rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-400"
        >
          전송
        </button>
      </div>
    </div>
  );
}
