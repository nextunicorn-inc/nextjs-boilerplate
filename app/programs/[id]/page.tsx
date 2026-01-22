import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';

interface Props {
  params: {
    id: string;
  };
}

export default async function ProgramDetailPage({ params }: Props) {
  const { id } = await params;

  const program = await prisma.supportProgram.findUnique({
    where: { id },
  });

  if (!program) {
    notFound();
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
