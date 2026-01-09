"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  BarChart2,
  LineChart,
  X,
  Loader2,
  ArrowRight,
  Sparkles,
  Settings2,
  Search,
  ChevronDown,
} from "lucide-react";

// Server Actions
import { getGa4Properties, type Ga4Property } from "@/app/actions/ga4-admin";
import { getGscSites, type GscSite } from "@/app/actions/gsc-admin";
import { validateAmplitude } from "@/app/actions/tools/validate-tools";
import { chatWithGemini } from "@/app/actions/gemini-agent";

// --- Types ---
type ConnectionStatus = "idle" | "loading" | "connected" | "error";
type Message = { role: "user" | "assistant"; content: string };

function UnifiedAnalyticsPage() {
  const { data: session } = useSession();

  // --- State: Chat ---
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- State: Tools Status ---
  const [gaStatus, setGaStatus] = useState<ConnectionStatus>("idle");
  const [ampStatus, setAmpStatus] = useState<ConnectionStatus>("idle");

  // --- State: Google Settings Modal ---
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isLoadingGoogleData, setIsLoadingGoogleData] = useState(false);
  const [ga4List, setGa4List] = useState<Ga4Property[]>([]);
  const [gscList, setGscList] = useState<GscSite[]>([]);

  // 선택된 값 (임시 저장용)
  const [selectedGa4Id, setSelectedGa4Id] = useState("");
  const [selectedGscUrl, setSelectedGscUrl] = useState("");

  // --- State: Amplitude Modal ---
  const [isAmpModalOpen, setIsAmpModalOpen] = useState(false);
  const [ampCreds, setAmpCreds] = useState({ apiKey: "", secretKey: "" });
  const [ampError, setAmpError] = useState<string | null>(null);
  const [isAmpValidating, setIsAmpValidating] = useState(false);

  // --- Effect: Initial Load ---
  useEffect(() => {
    // 1. Amplitude Check
    const hasAmpKey = localStorage.getItem("amplitudeApiKey");
    if (hasAmpKey) setAmpStatus("connected");

    // 2. Google Session Check
    if (session?.accessToken) {
      handleGoogleSession(session.accessToken);
    }
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Logic: Google Connect & Settings ---

  const handleGoogleSession = async (token: string) => {
    // 이미 설정된 값이 있는지 확인
    const savedGa4Id = localStorage.getItem("ga4PropertyId");
    const savedGscUrl = localStorage.getItem("gscSiteUrl");

    if (savedGa4Id || savedGscUrl) {
      setGaStatus("connected");
    } else {
      // 로그인은 됐는데 설정값이 없으면 -> 데이터 로드 후 모달 띄우기 (자동)
      await fetchGoogleLists(token);
      setIsGoogleModalOpen(true);
    }
  };

  const fetchGoogleLists = async (token: string) => {
    setIsLoadingGoogleData(true);
    try {
      const [ga4Data, gscData] = await Promise.all([
        getGa4Properties(token),
        getGscSites(token),
      ]);
      setGa4List(ga4Data || []);
      setGscList(gscData || []);

      // 기존 선택값 or 첫번째 값으로 기본 설정
      const savedGa4Id = localStorage.getItem("ga4PropertyId");
      const savedGscUrl = localStorage.getItem("gscSiteUrl");

      setSelectedGa4Id(savedGa4Id || ga4Data?.[0]?.numericId || "");
      setSelectedGscUrl(savedGscUrl || gscData?.[0]?.siteUrl || "");
    } catch (e) {
      console.error("Failed to load Google data", e);
    } finally {
      setIsLoadingGoogleData(false);
    }
  };

  const handleGoogleButtonClick = async () => {
    if (!session) {
      signIn("google"); // 로그인 안 되어 있으면 로그인
    } else {
      // 로그인 되어 있으면 설정 모달 열기
      await fetchGoogleLists(session.accessToken!);
      setIsGoogleModalOpen(true);
    }
  };

  const handleSaveGoogleSettings = () => {
    if (selectedGa4Id) localStorage.setItem("ga4PropertyId", selectedGa4Id);
    if (selectedGscUrl) localStorage.setItem("gscSiteUrl", selectedGscUrl);

    setGaStatus("connected");
    setIsGoogleModalOpen(false);
  };

  // --- Logic: Amplitude Connect ---
  const handleAmpSubmit = async () => {
    if (!ampCreds.apiKey || !ampCreds.secretKey) return;
    setIsAmpValidating(true);
    setAmpError(null);

    try {
      const result = await validateAmplitude(
        ampCreds.apiKey,
        ampCreds.secretKey
      );
      if (result.success) {
        localStorage.setItem("amplitudeApiKey", ampCreds.apiKey);
        localStorage.setItem("amplitudeSecretKey", ampCreds.secretKey);
        setAmpStatus("connected");
        setIsAmpModalOpen(false);
      } else {
        setAmpError("연동에 실패했습니다. 키 값을 확인해주세요.");
      }
    } catch (e) {
      setAmpError("서버 오류가 발생했습니다.");
    } finally {
      setIsAmpValidating(false);
    }
  };

  // --- Logic: Chat ---
  const isAnyToolConnected =
    gaStatus === "connected" || ampStatus === "connected";

  const handleSendMessage = async () => {
    if (!input.trim() || !isAnyToolConnected || isChatLoading) return;

    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);

    const apiKeys: Record<string, string | undefined> = {
      ga4AccessToken: session?.accessToken,
      gscAccessToken: session?.accessToken,
      ga4PropertyId: localStorage.getItem("ga4PropertyId") || undefined,
      gscSiteUrl: localStorage.getItem("gscSiteUrl") || undefined,
      amplitudeApiKey: localStorage.getItem("amplitudeApiKey") || undefined,
      amplitudeSecretKey:
        localStorage.getItem("amplitudeSecretKey") || undefined,
    };

    try {
      const response = await chatWithGemini(userMsg, apiKeys);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "죄송합니다. 오류가 발생했습니다." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- Component: Tool Button ---
  const ToolButton = ({
    label,
    icon: Icon,
    status,
    onClick,
  }: {
    label: string;
    icon: any;
    status: ConnectionStatus;
    onClick: () => void;
  }) => {
    let containerClass =
      "bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md";
    let iconColor = "text-gray-400 group-hover:text-indigo-500";

    if (status === "connected") {
      containerClass =
        "bg-green-50 border-green-200 text-green-700 shadow-sm ring-1 ring-green-100 hover:bg-green-100";
      iconColor = "text-green-600";
    } else if (status === "error") {
      containerClass = "bg-red-50 border-red-200 text-red-700";
      iconColor = "text-red-500";
    }

    return (
      <button
        onClick={onClick}
        className={`group flex items-center gap-2.5 px-5 py-2.5 rounded-full border transition-all duration-300 ${containerClass}`}
      >
        <Icon className={`w-4 h-4 transition-colors ${iconColor}`} />
        <span className="text-sm font-bold">{label}</span>
        {status === "connected" ? (
          <Settings2 className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
        ) : status === "loading" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : null}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-gray-900 overflow-hidden relative selection:bg-indigo-100">
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-100 rounded-full blur-3xl opacity-40"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-violet-100 rounded-full blur-3xl opacity-40"></div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-4 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            <div className="relative mb-8 group">
              <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative w-20 h-20 bg-white rounded-2xl border border-indigo-100 shadow-xl flex items-center justify-center">
                <Bot className="w-10 h-10 text-indigo-600" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3 text-center tracking-tight">
              무엇을 도와드릴까요?
            </h1>
            <p className="text-gray-500 text-lg mb-8 text-center max-w-md">
              데이터 소스를 연결하고 AI에게 인사이트를 요청하세요.
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-6 pt-10 pb-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
                  } animate-fade-in-up`}
              >
                <div
                  className={`p-5 max-w-[85%] rounded-2xl leading-relaxed shadow-sm text-[15px] ${m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-white text-gray-800 border border-gray-100 rounded-bl-none shadow-md"
                    }`}
                >
                  {m.role === "assistant" ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={
                        {
                          /* ...styles... */
                        }
                      }
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-bl-none shadow-md flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                  <span className="text-sm text-gray-500 font-medium">
                    데이터 분석 중입니다...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="w-full bg-white/80 backdrop-blur-md border-t border-gray-100 pb-8 pt-6 z-10">
        <div className="max-w-3xl mx-auto px-4">
          <div className="relative group">
            <textarea
              className={`w-full p-4 pr-14 rounded-2xl border transition-all resize-none outline-none shadow-sm text-gray-900 placeholder:text-gray-400
                ${isAnyToolConnected
                  ? "bg-white border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  : "bg-gray-50 border-gray-200 cursor-not-allowed opacity-70"
                }`}
              rows={1}
              style={{ minHeight: "60px", maxHeight: "200px" }}
              placeholder={
                isAnyToolConnected
                  ? "예: 지난주 GA4 트래픽 요약해줘"
                  : "분석을 시작하려면 아래 도구를 먼저 연동해주세요."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isAnyToolConnected || isChatLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || !isAnyToolConnected || isChatLoading}
              className={`absolute right-3 top-3 p-2.5 rounded-xl transition-all flex items-center justify-center
                ${input.trim() && isAnyToolConnected && !isChatLoading
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
            >
              {isChatLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            <ToolButton
              label="Google Analytics"
              icon={BarChart2}
              status={gaStatus}
              onClick={handleGoogleButtonClick}
            />
            <ToolButton
              label="Amplitude"
              icon={LineChart}
              status={ampStatus}
              onClick={() => {
                if (ampStatus !== "connected") setIsAmpModalOpen(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* --- ✨ New Google Settings Modal --- */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-orange-600" />
                </div>
                Google 데이터 설정
              </h2>
              <button
                onClick={() => setIsGoogleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {isLoadingGoogleData ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <span className="text-sm">속성 정보를 불러오는 중...</span>
                </div>
              ) : (
                <>
                  {/* GA4 Select */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 ml-1 flex items-center gap-1">
                      <BarChart2 className="w-3 h-3" /> GA4 속성 선택
                    </label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
                        value={selectedGa4Id}
                        onChange={(e) => setSelectedGa4Id(e.target.value)}
                      >
                        <option value="">속성을 선택하세요</option>
                        {ga4List.map((p) => (
                          <option key={p.numericId} value={p.numericId}>
                            {p.displayName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* GSC Select */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 ml-1 flex items-center gap-1">
                      <Search className="w-3 h-3" /> Search Console 사이트 선택
                    </label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
                        value={selectedGscUrl}
                        onChange={(e) => setSelectedGscUrl(e.target.value)}
                      >
                        <option value="">사이트를 선택하세요</option>
                        {gscList.map((s) => (
                          <option key={s.siteUrl} value={s.siteUrl}>
                            {s.siteUrl}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 pt-2 bg-gray-50/50">
              <button
                onClick={handleSaveGoogleSettings}
                disabled={
                  isLoadingGoogleData || (!selectedGa4Id && !selectedGscUrl)
                }
                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                설정 저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Amplitude Modal (Same as before) --- */}
      {isAmpModalOpen && (
        /* ... 이전과 동일한 Amplitude Modal 코드 (생략 없이 사용하세요) ... */
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                  <LineChart className="w-5 h-5 text-teal-600" />
                </div>
                Amplitude 연동
              </h2>
              <button
                onClick={() => setIsAmpModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              className="p-8 space-y-5"
              autoComplete="off"
              onSubmit={(e) => {
                e.preventDefault();
                handleAmpSubmit();
              }}
            >
              <input type="text" style={{ display: "none" }} />
              <input type="password" style={{ display: "none" }} />
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
                  API Key
                </label>
                <input
                  type="text"
                  name="amp_key"
                  autoComplete="off"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="Amplitude API Key"
                  value={ampCreds.apiKey}
                  onChange={(e) =>
                    setAmpCreds((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">
                  Secret Key
                </label>
                <input
                  type="password"
                  name="amp_secret"
                  autoComplete="new-password"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="Amplitude Secret Key"
                  value={ampCreds.secretKey}
                  onChange={(e) =>
                    setAmpCreds((prev) => ({
                      ...prev,
                      secretKey: e.target.value,
                    }))
                  }
                />
              </div>
              {ampError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                  {ampError}
                </div>
              )}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={
                    isAmpValidating ||
                    !ampCreds.apiKey.trim() ||
                    !ampCreds.secretKey.trim()
                  }
                  className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 ${ampCreds.apiKey.trim() &&
                      ampCreds.secretKey.trim() &&
                      !isAmpValidating
                      ? "bg-gray-900 text-white hover:bg-black shadow-lg"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                >
                  {isAmpValidating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "연동하기"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// CSR Only
const DynamicHome = dynamic(() => Promise.resolve(UnifiedAnalyticsPage), {
  ssr: false,
});
export default DynamicHome;
