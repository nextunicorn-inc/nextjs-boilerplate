import Link from "next/link";
import { Bot, ArrowRight, Lock, Zap, LineChart } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-indigo-100">
      {/* 1. Navigation Bar */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              AI
            </div>
            <span className="text-xl font-bold text-gray-900">
              Analytics AI
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
            >
              기능 소개
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
            >
              이용 방법
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
            >
              요금제
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              로그인
            </Link>
            <Link
              href="/chatt"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-full transition-all shadow-md hover:shadow-lg"
            >
              무료로 시작하기
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold mb-8 animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            새로운 AI 데이터 분석 기능 출시
          </div>

          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
            흩어진 데이터를 <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
              하나의 AI 인사이트로.
            </span>
          </h1>

          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            GA4, Search Console, Amplitude... 따로 보지 마세요.
            <br className="hidden md:block" />
            AI가 모든 데이터를 통합 분석하여 성장을 위한 핵심 전략을 제안합니다.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/chatt"
              className="w-full sm:w-auto px-8 py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-lg flex items-center justify-center gap-2 transition-all hover:-translate-y-1 shadow-xl"
            >
              분석 시작하기 <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#demo"
              className="w-full sm:w-auto px-8 py-4 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-bold rounded-xl text-lg flex items-center justify-center transition-all hover:bg-gray-50"
            >
              데모 영상 보기
            </Link>
          </div>

          {/* Hero Dashboard Mockup */}
          <div className="mt-16 relative mx-auto max-w-5xl">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20"></div>
            <div className="relative bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
              {/* Mock Header */}
              <div className="h-8 bg-gray-50 border-b border-gray-100 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              {/* Mock Content */}
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                  <div className="text-orange-600 font-bold text-sm mb-1">
                    Google Analytics
                  </div>
                  <div className="text-2xl font-bold text-gray-900">12,450</div>
                  <div className="text-xs text-gray-500">전주 대비 +15% ▲</div>
                </div>
                <div className="bg-teal-50 p-4 rounded-xl border border-teal-100">
                  <div className="text-teal-600 font-bold text-sm mb-1">
                    Search Console
                  </div>
                  <div className="text-2xl font-bold text-gray-900">8,200</div>
                  <div className="text-xs text-gray-500">노출수 급상승 🔥</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-center items-center text-center">
                  <Bot className="w-8 h-8 text-indigo-600 mb-2" />
                  <p className="text-sm font-medium text-indigo-900">
                    "지금 사용자 유입이 늘고 있어요!
                    <br />
                    전환율 최적화가 필요합니다."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base font-bold text-indigo-600 uppercase tracking-wide">
              Features
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              데이터 분석, 이제 AI에게 맡기세요
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
                <LineChart className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                올인원 대시보드
              </h3>
              <p className="text-gray-500 leading-relaxed">
                GA4, Search Console, Amplitude 등 흩어진 툴을 하나로 통합하세요.
                더 이상 여러 탭을 오갈 필요가 없습니다.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-6">
                <Bot className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                AI 인사이트 Chat
              </h3>
              <p className="text-gray-500 leading-relaxed">
                "이번 주 매출이 왜 떨어졌어?"라고 물어보세요. AI가 데이터를
                분석해 원인과 해결책을 즉시 답변합니다.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
                <Lock className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                안전한 보안 관리
              </h3>
              <p className="text-gray-500 leading-relaxed">
                모든 API 키와 데이터는 암호화되어 저장됩니다. OAuth 연동으로
                비밀번호 공유 없이 안전하게 연결하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Supported Tools (Logo Grid) */}
      <section className="py-20 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-lg font-medium text-gray-500 mb-10">
            다음 툴들과 즉시 연동됩니다
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Logos (Text Replacements for SVGs) */}
            <div className="flex items-center gap-2 text-xl font-bold text-gray-800">
              <span className="text-orange-500 text-2xl">📊</span> Google
              Analytics 4
            </div>
            <div className="flex items-center gap-2 text-xl font-bold text-gray-800">
              <span className="text-teal-500 text-2xl">🔍</span> Search Console
            </div>
            <div className="flex items-center gap-2 text-xl font-bold text-gray-800">
              <span className="text-blue-500 text-2xl">📈</span> Amplitude
            </div>
            <div className="flex items-center gap-2 text-xl font-bold text-gray-800">
              <span className="text-blue-600 text-2xl">📢</span> Meta Ads
            </div>
          </div>
        </div>
      </section>

      {/* 5. How it Works */}
      <section id="how-it-works" className="py-24 bg-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              단 3분이면 분석 준비 끝
            </h2>
            <p className="mt-4 text-indigo-200 text-lg">
              복잡한 설치 과정 없이 클릭 몇 번으로 시작하세요.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="relative">
              <div className="w-16 h-16 mx-auto bg-indigo-700 rounded-full flex items-center justify-center text-2xl font-bold mb-6 border-4 border-indigo-800">
                1
              </div>
              <h3 className="text-xl font-bold mb-2">계정 연결</h3>
              <p className="text-indigo-200">
                Google 또는 API Key로
                <br />
                데이터 소스를 연결합니다.
              </p>
            </div>
            <div className="relative">
              <div className="hidden md:block absolute top-8 left-[-50%] right-[50%] h-0.5 bg-indigo-800 -z-10"></div>
              <div className="w-16 h-16 mx-auto bg-indigo-700 rounded-full flex items-center justify-center text-2xl font-bold mb-6 border-4 border-indigo-800">
                2
              </div>
              <h3 className="text-xl font-bold mb-2">자동 데이터 수집</h3>
              <p className="text-indigo-200">
                AI가 매일 데이터를 수집하고
                <br />
                주요 지표를 분석합니다.
              </p>
            </div>
            <div className="relative">
              <div className="hidden md:block absolute top-8 left-[-50%] right-[50%] h-0.5 bg-indigo-800 -z-10"></div>
              <div className="w-16 h-16 mx-auto bg-indigo-700 rounded-full flex items-center justify-center text-2xl font-bold mb-6 border-4 border-indigo-800">
                3
              </div>
              <h3 className="text-xl font-bold mb-2">인사이트 발견</h3>
              <p className="text-indigo-200">
                대시보드와 채팅을 통해
                <br />
                성장 전략을 확인하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-10 md:p-16 text-center text-white shadow-2xl relative overflow-hidden">
          {/* Background Decorative Circles */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>

          <h2 className="text-3xl md:text-5xl font-extrabold mb-6 relative z-10">
            데이터 기반 성장을 지금 시작하세요
          </h2>
          <p className="text-lg md:text-xl text-indigo-100 mb-10 max-w-2xl mx-auto relative z-10">
            더 이상 감으로 비즈니스 하지 마세요. <br />
            Analytics AI가 정확한 데이터 나침반이 되어드립니다.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-10 py-5 text-lg font-bold text-indigo-600 bg-white rounded-full hover:bg-gray-50 transition-colors shadow-lg relative z-10"
          >
            <Zap className="w-5 h-5 mr-2 fill-indigo-600" />
            무료로 체험하기
          </Link>
          <p className="mt-4 text-sm text-indigo-200 opacity-80 relative z-10">
            * 신용카드 등록 없이 바로 시작할 수 있습니다.
          </p>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center text-white text-xs font-bold">
                  AI
                </div>
                <span className="font-bold text-gray-900">Analytics AI</span>
              </div>
              <p className="text-sm text-gray-500">
                데이터 분석을 더 쉽고 스마트하게.
                <br />
                비즈니스 성장을 돕는 AI 파트너.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="#" className="hover:text-indigo-600">
                    기능 소개
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-indigo-600">
                    연동 서비스
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-indigo-600">
                    요금제
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="#" className="hover:text-indigo-600">
                    팀 소개
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-indigo-600">
                    채용
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-indigo-600">
                    블로그
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="#" className="hover:text-indigo-600">
                    고객센터
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-indigo-600">
                    이용약관
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-indigo-600">
                    개인정보처리방침
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">
              © 2024 Analytics AI. All rights reserved.
            </p>
            <div className="flex gap-4">
              {/* Social Icons Placeholder */}
              <div className="w-5 h-5 bg-gray-300 rounded-full hover:bg-gray-400 cursor-pointer"></div>
              <div className="w-5 h-5 bg-gray-300 rounded-full hover:bg-gray-400 cursor-pointer"></div>
              <div className="w-5 h-5 bg-gray-300 rounded-full hover:bg-gray-400 cursor-pointer"></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
