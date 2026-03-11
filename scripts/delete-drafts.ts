/**
 * One-off: delete all projects where isDraft === true.
 * Run: npx tsx scripts/delete-drafts.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.project.deleteMany({
    where: { isDraft: true },
  });
  console.log(`Deleted ${result.count} draft project(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
