import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Sheet formats
  const existing = await prisma.sheetFormat.count();
  if (existing === 0) {
    await prisma.sheetFormat.createMany({
      data: [
        { id: "fmt-9x4-7", label: '9\'1" x 4\'7"', lengthIn: 109, widthIn: 55, isCustom: false },
        { id: "fmt-8x4-1", label: '8\'1" x 4\'1"', lengthIn: 97, widthIn: 49, isCustom: false },
        { id: "fmt-custom", label: "Custom", lengthIn: 0, widthIn: 0, isCustom: true },
      ],
    });
  }

  // Employees — salespeople
  const empCount = await prisma.employee.count();
  if (empCount === 0) {
    await prisma.employee.createMany({
      data: [
        { name: "Jessy", email: "Jessy@evos.ca", role: "salesperson", color: "#6366f1" },
        { name: "Melya", email: "Melya@evos.ca", role: "salesperson", color: "#8b5cf6" },
        { name: "Olivier", email: "Olivier@evos.ca", role: "salesperson", color: "#0ea5e9" },
        { name: "Kyle", email: "Kyle@evos.ca", role: "salesperson", color: "#14b8a6" },
        { name: "Jenny", email: "Jenny@evos.ca", role: "salesperson", color: "#ec4899" },
      ],
    });
    console.log("Seeded 5 employees");
  }

  // Work stations
  const stationCount = await prisma.workStation.count();
  if (stationCount === 0) {
    await prisma.workStation.createMany({
      data: [
        { name: "Scie table", slug: "scie-table", sortOrder: 0 },
        { name: "Plaqueuse de chants", slug: "plaqueuse-chants", sortOrder: 1 },
        { name: "Assemblage", slug: "assemblage", sortOrder: 2 },
        { name: "Finition", slug: "finition", sortOrder: 3 },
        { name: "CNC", slug: "cnc", sortOrder: 4 },
        { name: "Chargement / Livraison", slug: "chargement", sortOrder: 5 },
      ],
    });
    console.log("Seeded 6 work stations");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
