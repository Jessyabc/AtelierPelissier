import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.sheetFormat.count();
  if (existing > 0) return;
  // 9'1" x 4'7" = 109" x 55", 8'1" x 4'1" = 97" x 49"
  await prisma.sheetFormat.createMany({
    data: [
      { id: "fmt-9x4-7", label: '9\'1" x 4\'7"', lengthIn: 109, widthIn: 55, isCustom: false },
      { id: "fmt-8x4-1", label: '8\'1" x 4\'1"', lengthIn: 97, widthIn: 49, isCustom: false },
      { id: "fmt-custom", label: "Custom", lengthIn: 0, widthIn: 0, isCustom: true },
    ],
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
