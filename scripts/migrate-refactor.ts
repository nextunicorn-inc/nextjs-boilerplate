import { PrismaClient } from '@prisma/client';
import { extractApplicationTarget } from '../lib/llm/extract-target';

const prisma = new PrismaClient();

async function main() {
  console.log('Mass Migration Script Started...');

  // Fetch ALL programs to ensure quality
  // Order by newest first
  const programs = await prisma.supportProgram.findMany({
    orderBy: { createdAt: 'desc' },
    // take: 100 // Process all chunks if possible, or loop. Let's do 50 at a time safely or just all?
    // Doing all might take time. Let's iterate.
  });

  console.log(`Found ${programs.length} total programs. Inspecting for re-processing...`);

  let processedCount = 0;
  let skippedCount = 0;

  for (const program of programs) {
    // Condition: Check if targetDetail is empty OR if we just want to force update everything.
    // User said "Check everything".
    // Also skip if no text.
    if (!program.eligibility && !program.description) {
      skippedCount++;
      continue;
    }

    // Force update logic:
    // Even if it has data, re-run to match new "Full Text" quality standard.
    // Unless it was updated very recently? No, safe to redo.

    console.log(`[${processedCount + 1}/${programs.length}] Re-processing: ${program.title.substring(0, 30)}...`);

    try {
      const target = await extractApplicationTarget(
        program.eligibility || '',
        program.description || ''
      );

      if (target) {
        // Update DB
        await prisma.supportProgram.update({
          where: { id: program.id },
          data: {
            aiSummary: target.aiSummary,
            targetDetail: target.targetDetail,
            exclusionDetail: target.exclusionDetail,
            llmProcessed: true,
            // applicationTarget: null // Ensure old data is cleared
          },
        });
        console.log(`  > Updated OK (${target.aiSummary?.length ?? 0} chars summary)`);
      } else {
        console.log(`  > Failed to extract target (Returned null)`);
      }

      // Rate Limit mainly for Gemini API quota
      // Flash model has high rate limit but let's be safe.
      await new Promise(r => setTimeout(r, 1000));
      processedCount++;

    } catch (e) {
      console.error(`  > Error processing ${program.id}:`, e);
    }
  }

  console.log(`Migration Completed. Processed: ${processedCount}, Skipped: ${skippedCount}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
