'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SupportProgram {
  id: string;
  source: string;
  sourceId: string;
  category: string;
  title: string;
  organization: string | null;
  region: string | null;
  applicationStart: string | null;
  applicationEnd: string | null;
  url: string;
  viewCount: number | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CrawlResult {
  success: boolean;
  count: number;
  errors?: string[];
}

export default function Home() {
  const router = useRouter();
  const [programs, setPrograms] = useState<SupportProgram[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  // 데이터 조회
  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', '15');
      if (selectedSource) params.set('source', selectedSource);

      const response = await fetch(`/api/programs?${params}`);
      const data = await response.json();

      if (data.success) {
        setPrograms(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('데이터 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedSource]);

  // 크롤링 실행
  const handleCrawl = async (source?: string) => {
    setCrawling(true);
    setCrawlStatus('크롤링 중...');

    try {
      const params = new URLSearchParams();
      if (source) params.set('source', source);
      params.set('maxPages', '2');
      params.set('fetchDetails', 'true');

      const response = await fetch(`/api/crawl?${params}`);
      const data = await response.json();

      if (data.success) {
        const results = data.results as { [key: string]: CrawlResult };
        const summary = Object.entries(results)
          .map(([key, val]) => `${key}: ${val.count}개`)
          .join(', ');
        setCrawlStatus(`✅ 완료! ${summary}`);
        // 데이터 새로고침
        await fetchPrograms();
        router.refresh();
        setCurrentPage(1);
      } else {
        setCrawlStatus('❌ 크롤링 실패');
      }
    } catch (error) {
      console.error('크롤링 실패:', error);
      setCrawlStatus('❌ 크롤링 오류 발생');
    } finally {
      setCrawling(false);
      // 3초 후 상태 메시지 제거
      setTimeout(() => setCrawlStatus(null), 5000);
    }
  };

  // 초기 로드
  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  // 날짜 포맷팅
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const yy = date.getFullYear().toString().slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${yy}.${mm}.${dd} ${hh}:${min}:${ss}`;
  };

  // D-day 계산
  const getDday = (dateStr: string | null) => {
    if (!dateStr) return null;
    const today = new Date();
    const endDate = new Date(dateStr);
    const diff = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return null;
    if (diff === 0) return 'D-Day';
    return `D-${diff}`;
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      {/* 헤더 */}
      <header className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">
              파인드덱 <span className="text-zinc-500 font-normal text-sm ml-2">Admin</span>
            </h1>
            <div className="flex items-center gap-3">
              {crawlStatus && (
                <span className="text-sm text-zinc-400">{crawlStatus}</span>
              )}
              <button
                onClick={() => handleCrawl()}
                disabled={crawling}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {crawling ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    크롤링 중...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    크롤링 실행
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* 필터 및 통계 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
            >
              <option value="">전체 소스</option>
              <option value="k-startup">K-Startup</option>
              <option value="bizinfo">기업마당</option>
            </select>
            <button
              onClick={() => fetchPrograms()}
              disabled={loading}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              새로고침
            </button>
          </div>
          {pagination && (
            <div className="text-sm text-zinc-500">
              총 <span className="text-zinc-300 font-medium">{pagination.total}</span>개 공고
            </div>
          )}
        </div>

        {/* 테이블 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-32">소스</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">제목</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider w-40">수집일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-zinc-500">
                      <svg className="h-6 w-6 animate-spin mx-auto mb-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      로딩 중...
                    </td>
                  </tr>
                ) : programs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-zinc-500">
                      데이터가 없습니다. 크롤링을 실행해주세요.
                    </td>
                  </tr>
                ) : (
                  programs.map((program) => (
                    <tr
                      key={program.id}
                      onClick={() => router.push(`/programs/${program.id}`)}
                      className="hover:bg-zinc-900/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${program.source === 'k-startup'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-green-500/20 text-green-400'
                          }`}>
                          {program.source === 'k-startup' ? 'K-Startup' : '기업마당'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-100 group-hover:text-blue-400 transition-colors line-clamp-2">
                          {program.title.replace(/\s+/g, ' ').trim()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-400">
                        {formatDate(program.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {pagination && pagination.totalPages > 1 && (
            <div className="border-t border-zinc-800 px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-zinc-500">
                페이지 {pagination.page} / {pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  이전
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
