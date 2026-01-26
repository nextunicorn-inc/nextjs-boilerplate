import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';

interface Props {
  params: {
    id: string;
  };
}

// LLM 추출된 applicationTarget 타입
interface ApplicationTarget {
  businessStatus?: string[];
  industryCode?: string[];
  industryKeywords?: string[];
  employeeRange?: string;
  revenueRange?: string;
  specialConditions?: string[];
  excludeConditions?: string[];
  otherConditions?: string;
}

export default async function ProgramDetailPage({ params }: Props) {
  const { id } = await params;

  const program = await prisma.supportProgram.findUnique({
    where: { id },
  });

  if (!program) {
    notFound();
  }

  // applicationTarget JSON 파싱
  let appTarget: ApplicationTarget | null = null;
  if (program.applicationTarget) {
    try {
      appTarget = JSON.parse(program.applicationTarget);
    } catch {
      console.error('Failed to parse applicationTarget');
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '미정 / 상시';
    return format(date, 'yyyy-MM-dd HH:mm');
  };

  const InfoRow = ({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) => (
    <div className={`grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4 ${className}`}>
      <dt className="font-medium text-zinc-400">{label}</dt>
      <dd className="text-zinc-100 sm:col-span-2">{value ?? '-'}</dd>
    </div>
  );

  // 배열을 태그로 표시하는 컴포넌트
  const TagList = ({ items, color = 'blue' }: { items: string[] | undefined; color?: 'blue' | 'green' | 'red' | 'yellow' }) => {
    if (!items || items.length === 0) return <span className="text-zinc-500">-</span>;
    const colors = {
      blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      green: 'bg-green-500/20 text-green-300 border-green-500/30',
      red: 'bg-red-500/20 text-red-300 border-red-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    };
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, idx) => (
          <span key={idx} className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${colors[color]}`}>
            {item}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 p-6 md:p-12">
      <div className="mx-auto max-w-4xl">
        {/* 네비게이션 */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            ← 목록으로 돌아가기
          </Link>
        </div>

        {/* 헤더 */}
        <div className="mb-8 border-b border-zinc-800 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${program.source === 'k-startup'
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-green-500/20 text-green-400'
              }`}>
              {program.source === 'k-startup' ? 'K-Startup' : '기업마당'}
            </span>
            <span className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
              {program.category}
            </span>
            {program.viewCount !== null && (
              <span className="text-xs text-zinc-500">
                조회 {program.viewCount.toLocaleString()}
              </span>
            )}
            {program.llmProcessed && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                AI 분석 완료
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-white mb-6 leading-tight">
            {program.title}
          </h1>
          <div className="flex flex-wrap gap-4">
            <a
              href={program.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              원본 공고 보기 ↗
            </a>
          </div>
        </div>

        {/* 주요 정보 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* 왼쪽: 기본 정보 */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">기본 정보</h2>
            <dl className="divide-y divide-zinc-800/50">
              <InfoRow label="주관기관" value={program.organization} />
              <InfoRow label="지원분야" value={program.supportField} />
              <InfoRow label="기관구분" value={program.institutionType} />
              <InfoRow label="지역" value={program.region} />
              <InfoRow label="접수기간" value={
                <div className="flex flex-col gap-1">
                  <span>{formatDate(program.applicationStart)} ~</span>
                  <span className="text-red-400 font-medium">{formatDate(program.applicationEnd)}</span>
                </div>
              } />
            </dl>
          </div>

          {/* 오른쪽: 타겟 매칭 정보 */}
          <div className="rounded-xl border border-blue-900/30 bg-blue-950/10 p-6">
            <h2 className="text-lg font-semibold text-blue-100 mb-4">매칭 조건</h2>
            <dl className="divide-y divide-blue-900/30">
              <InfoRow label="대상 연령" value={program.targetAge} className="border-blue-900/30" />
              <InfoRow label="대상 지역" value={program.targetRegion} className="border-blue-900/30" />
              <InfoRow label="대상 기업" value={program.targetType} className="border-blue-900/30" />
              <InfoRow label="창업 업력" value={program.companyAge} className="border-blue-900/30" />
            </dl>
          </div>
        </div>

        {/* AI 분석 결과 (applicationTarget) */}
        {appTarget && (
          <div className="mb-12 rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-6">
            <h2 className="text-lg font-semibold text-emerald-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              AI 분석 신청대상
            </h2>
            <dl className="space-y-4">
              {appTarget.businessStatus && appTarget.businessStatus.length > 0 && (
                <div>
                  <dt className="text-sm font-medium text-zinc-400 mb-2">사업자 유형</dt>
                  <dd><TagList items={appTarget.businessStatus} color="blue" /></dd>
                </div>
              )}
              {appTarget.industryKeywords && appTarget.industryKeywords.length > 0 && (
                <div>
                  <dt className="text-sm font-medium text-zinc-400 mb-2">산업 분야</dt>
                  <dd><TagList items={appTarget.industryKeywords} color="green" /></dd>
                </div>
              )}
              {appTarget.employeeRange && (
                <div>
                  <dt className="text-sm font-medium text-zinc-400 mb-2">종업원 수</dt>
                  <dd className="text-zinc-100">{appTarget.employeeRange}</dd>
                </div>
              )}
              {appTarget.revenueRange && (
                <div>
                  <dt className="text-sm font-medium text-zinc-400 mb-2">매출 조건</dt>
                  <dd className="text-zinc-100">{appTarget.revenueRange}</dd>
                </div>
              )}
              {appTarget.specialConditions && appTarget.specialConditions.length > 0 && (
                <div>
                  <dt className="text-sm font-medium text-zinc-400 mb-2">우대 조건</dt>
                  <dd><TagList items={appTarget.specialConditions} color="yellow" /></dd>
                </div>
              )}
              {appTarget.excludeConditions && appTarget.excludeConditions.length > 0 && (
                <div>
                  <dt className="text-sm font-medium text-zinc-400 mb-2">제외 조건</dt>
                  <dd><TagList items={appTarget.excludeConditions} color="red" /></dd>
                </div>
              )}
              {appTarget.otherConditions && (
                <div>
                  <dt className="text-sm font-medium text-zinc-400 mb-2">기타 조건</dt>
                  <dd className="text-zinc-300 text-sm">{appTarget.otherConditions}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* 상세 내용 섹션 */}
        <div className="space-y-8">
          {/* 지원 자격 */}
          {program.eligibility && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
              <h2 className="text-xl font-bold text-white mb-4">지원 자격 및 요건</h2>
              <div className="prose prose-invert max-w-none whitespace-pre-wrap text-zinc-300 text-sm leading-relaxed">
                {program.eligibility}
              </div>
            </section>
          )}

          {/* 사업 개요 */}
          {program.description && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
              <h2 className="text-xl font-bold text-white mb-4">사업 개요</h2>
              <div className="prose prose-invert max-w-none whitespace-pre-wrap text-zinc-300 text-sm leading-relaxed">
                {program.description}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
