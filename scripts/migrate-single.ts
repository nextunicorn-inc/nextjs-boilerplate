import { PrismaClient } from '@prisma/client';
import { extractApplicationTarget } from '../lib/llm/extract-target';

const prisma = new PrismaClient();
const TARGET_ID = 'd4a6a229-4c4c-40eb-8be6-4df4dd28b145';

async function main() {
  console.log(`Force processing ${TARGET_ID}...`);

  const program = await prisma.supportProgram.findUnique({
    where: { id: TARGET_ID },
  });

  if (!program) {
    console.error('Program not found!');
    return;
  }

  console.log(`Target Found: ${program.title}`);

  if (!program.eligibility && !program.description) {
    console.log(`Skipping (No text content)`);
    return;
  }

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
        },
      });
      console.log(`  > Updated Successfully!`);
      console.log(`  > Summary: ${target.aiSummary?.substring(0, 50)}...`);
    } else {
      console.log(`  > Failed to extract target (Returned null)`);
    }

  } catch (e) {
    console.error(`  > Error processing:`, e);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
