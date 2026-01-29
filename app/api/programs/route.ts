import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // 필터 파라미터
  const source = searchParams.get('source'); // k-startup, bizinfo
  const category = searchParams.get('category');
  const region = searchParams.get('region');
  const status = searchParams.get('status') || 'active';

  // 페이지네이션
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const skip = (page - 1) * limit;

  try {
    // 조건 빌드
    const where: Record<string, unknown> = {};

    if (source) {
      where.source = source;
    }

    if (category) {
      where.category = { contains: category };
    }

    if (region) {
      where.region = { contains: region };
    }

    if (status === 'active') {
      // 마감일이 없거나 아직 지나지 않은 공고
      where.OR = [
        { applicationEnd: null },
        { applicationEnd: { gte: new Date() } },
      ];
    }

    // 데이터 조회
    const [programs, total] = await Promise.all([
      prisma.supportProgram.findMany({
        where,
        orderBy: [
          { updatedAt: 'desc' }, // 최신 수집일 순
        ],
        skip,
        take: limit,
        select: {
          id: true,
          source: true,
          sourceId: true,
          category: true,
          title: true,
          organization: true,
          region: true,
          applicationStart: true,
          applicationEnd: true,
          url: true,
          viewCount: true,
          // 매칭용 정형 데이터
          targetAge: true,
          targetRegion: true,
          targetType: true,
          companyAge: true,
          supportField: true,
          institutionType: true,
          targetIndustry: true,
          eligibility: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.supportProgram.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: programs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('프로그램 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
