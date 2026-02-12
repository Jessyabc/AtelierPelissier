import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET: List all jobs (projects) with their service calls.
 * Ordered by job number, then by most recent service call date.
 */
export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      serviceCalls: {
        include: { items: true },
    orderBy: { serviceDate: { sort: "asc", nulls: "last" } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Sort: by job number (nulls last), then by latest service call / project date
  const sorted = [...projects].sort((a, b) => {
    const aJob = (a.jobNumber ?? "").trim().toUpperCase();
    const bJob = (b.jobNumber ?? "").trim().toUpperCase();
    if (aJob !== bJob) {
      if (!aJob) return 1;
      if (!bJob) return -1;
      return aJob.localeCompare(bJob);
    }
    const aDate = a.serviceCalls[0]?.serviceDate ?? a.updatedAt;
    const bDate = b.serviceCalls[0]?.serviceDate ?? b.updatedAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return NextResponse.json(sorted);
}
