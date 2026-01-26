export interface SupportProgramData {
  source: 'k-startup' | 'bizinfo';
  sourceId: string;
  category: string;
  title: string;
  organization?: string;
  region?: string;
  applicationStart?: Date;
  applicationEnd?: Date;
  url: string;
  description?: string;
  eligibility?: string;
  viewCount?: number;

  // 매칭용 정형 데이터
  targetAge?: string;       // 대상연령
  targetRegion?: string;    // 대상지역
  targetType?: string;      // 대상기업유형
  companyAge?: string;      // 창업업력
  supportField?: string;    // 지원분야
  institutionType?: string; // 기관구분
}

export interface CrawlResult {
  success: boolean;
  count: number;
  errors?: string[];
}

export interface CrawlOptions {
  maxPages?: number;
  fetchDetails?: boolean;
  usePuppeteer?: boolean;
  targetId?: string;
  limit?: number;
}
