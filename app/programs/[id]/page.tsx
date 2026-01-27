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
      <div className="mx-auto max-w-5xl">
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
          <h1 className="text-3xl font-bold text-white mb-6 leading-tight">
            {program.title}
          </h1>

          {/* 핵심 매칭 정보 (1,2,3순위) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg bg-zinc-800/50 p-4 border border-zinc-700/50">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">창업 업력</span>
              <span className="text-lg font-bold text-blue-400">{program.companyAge || '정보 없음'}</span>
            </div>
            <div className="rounded-lg bg-zinc-800/50 p-4 border border-zinc-700/50">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">모집 지역</span>
              <span className="text-lg font-bold text-emerald-400">{program.targetRegion || '정보 없음'}</span>
            </div>
            <div className="rounded-lg bg-zinc-800/50 p-4 border border-zinc-700/50">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">연령</span>
              <span className="text-lg font-bold text-purple-400">{program.targetAge || '정보 없음'}</span>
            </div>
            <div className="rounded-lg bg-zinc-800/50 p-4 border border-zinc-700/50">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">업종</span>
              <span className="text-lg font-bold text-orange-400">{program.targetIndustry || '정보 없음'}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <a
              href={program.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              원본 공고 보기 ↗
            </a>
          </div>
        </div>

        {/* 기본 정보 (확장) */}
        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-950">
          <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900 rounded-t-xl">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              ℹ️ 기본 정보
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <InfoRow label="지원 분야" value={program.supportField} />
            <InfoRow label="담당 기관" value={program.organization} />
            <InfoRow label="접수 기간" value={`${formatDate(program.applicationStart)} ~ ${formatDate(program.applicationEnd)}`} />
            <InfoRow label="지역 (상세)" value={program.region} />
            <div className="pt-4 border-t border-zinc-800">
              <dt className="font-medium text-zinc-400 mb-2">사업 개요</dt>
              <dd className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm">
                {program.description || '개요 정보 없음'}
              </dd>
            </div>
            {program.eligibility && (
              <div className="pt-4 border-t border-zinc-800">
                <dt className="font-medium text-zinc-400 mb-2">지원 대상 (원본)</dt>
                <dd className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm">
                  {program.eligibility}
                </dd>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
