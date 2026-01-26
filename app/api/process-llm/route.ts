import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { extractApplicationTarget } from '@/lib/llm/extract-target';

/**
 * POST /api/process-llm
 * 미처리 공고들의 LLM 신청대상 추출 실행
 * 
 * Query params:
 * - limit: 처리할 공고 수 (기본: 10)
 * - force: true일 경우 이미 처리된 공고도 재처리
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');
  const force = searchParams.get('force') === 'true';

  try {
    // 미처리 공고 조회
    const programs = await prisma.supportProgram.findMany({
      where: force ? {} : { llmProcessed: false },
      select: {
        id: true,
        title: true,
        eligibility: true,
        description: true,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    if (programs.length === 0) {
      return NextResponse.json({
        success: true,
        message: '처리할 공고가 없습니다.',
        processed: 0,
      });
    }

    console.log(`[LLM API] ${programs.length}개 공고 처리 시작...`);

    let successCount = 0;
    let errorCount = 0;
    const results: Array<{ id: string; title: string; success: boolean; target?: object }> = [];

    for (const program of programs) {
      try {
        console.log(`[LLM API] Processing: ${program.title.substring(0, 50)}...`);

        const target = await extractApplicationTarget(
          program.eligibility || '',
          program.description || ''
        );

        // DB 업데이트
        await prisma.supportProgram.update({
          where: { id: program.id },
          data: {
            applicationTarget: target ? JSON.stringify(target) : null,
            llmProcessed: true,
          },
        });

        successCount++;
        results.push({
          id: program.id,
          title: program.title,
          success: true,
          target: target || undefined,
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[LLM API] Error processing ${program.id}:`, error);
        errorCount++;
        results.push({
          id: program.id,
          title: program.title,
          success: false,
        });
      }
    }

    console.log(`[LLM API] 완료: ${successCount} 성공, ${errorCount} 실패`);

    return NextResponse.json({
      success: true,
      processed: successCount,
      errors: errorCount,
      results,
    });
  } catch (error) {
    console.error('[LLM API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/process-llm
 * LLM 처리 상태 조회
 */
export async function GET() {
  try {
    const [total, processed, unprocessed] = await Promise.all([
      prisma.supportProgram.count(),
      prisma.supportProgram.count({ where: { llmProcessed: true } }),
      prisma.supportProgram.count({ where: { llmProcessed: false } }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        total,
        processed,
        unprocessed,
        percentage: total > 0 ? Math.round((processed / total) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('[LLM API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
