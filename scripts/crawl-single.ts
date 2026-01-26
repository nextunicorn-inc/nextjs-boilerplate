import { crawlBizinfo } from '../lib/crawlers/bizinfo';
import prisma from '../lib/prisma';

async function main() {
  const TARGET_ID = 'PBLN_000000000117837';
  console.log(`Starting Crawl for ${TARGET_ID}...`);

  const result = await crawlBizinfo({
    maxPages: 1,
    fetchDetails: true,
    usePuppeteer: true,
    targetId: TARGET_ID
  });

  console.log('Crawl Result:', result);

  if (result.success) {
    // Verify DB
    const program = await prisma.supportProgram.findFirst({
      where: { sourceId: TARGET_ID }
    });
    console.log('DB Verification:');
    console.log(`- Title: ${program?.title}`);
    console.log(`- Target Length: ${program?.targetDetail?.length}`);
    console.log(`- Exclusion Length: ${program?.exclusionDetail?.length}`);
    console.log(`- Summary: ${program?.aiSummary?.substring(0, 50)}...`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
