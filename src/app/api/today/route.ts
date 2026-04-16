import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionWithUser } from "@/lib/auth/session";
import { getNextAction, type NextActionProject } from "@/lib/workflow/nextAction";

export const dynamic = "force-dynamic";

/**
 * GET /api/today
 *
 * Role-aware daily view. Everyone still gets `today|week|overdue` steps for
 * their linked employee (woodworkers rely on those), but we also surface:
 *
 * - `role`: the user's application role (admin|planner|salesperson|woodworker)
 * - `salesResponsibilities` (sales+admin): open projects the user should work on
 *   today — sorted by blocking priority (stage, readiness). Each row also
 *   carries the role-aware next action for a one-click CTA.
 * - `builderTodos` (sales+admin): projects that contain vanity/side_unit rooms
 *   whose builder inputs haven't been saved yet — "you still owe a vanity
 *   build-out for MC-1234" style reminders.
 * - `plannerJobs` (planner+admin): today's production steps grouped by
 *   project, with a `blocking` flag on the first unfinished step in each
 *   group so the UI can show "X is blocking Y" at a glance.
 *
 * Keeping role fan-out inside the API (rather than fetching everything on
 * the client) means we can enforce visibility rules and avoid shipping
 * data the requester shouldn't see.
 */
export async function GET() {
  const session = await getSessionWithUser();
  if (!session.ok) return session.response;

  const { dbUser } = session;
  const role = dbUser.role as string;

  // ── Employee-scoped buckets (woodworker's daily queue) ────────────────
  let employee: { id: string; name: string; color: string | null; role: string } | null = null;
  let today: unknown[] = [];
  let week: unknown[] = [];
  let overdue: unknown[] = [];

  if (dbUser.employeeId) {
    employee = await prisma.employee.findUnique({
      where: { id: dbUser.employeeId },
      select: { id: true, name: true, color: true, role: true },
    });

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(todayStart.getTime() + 8 * 24 * 60 * 60 * 1000);

    const include = {
      project: { select: { id: true, name: true, jobNumber: true } },
      step: { select: { id: true, label: true } },
    };

    [today, week, overdue] = await Promise.all([
      prisma.projectProcessStep.findMany({
        where: {
          assignedEmployeeId: dbUser.employeeId,
          scheduledDate: { gte: todayStart, lt: todayEnd },
          status: { not: "done" },
        },
        include,
        orderBy: { sortOrder: "asc" },
      }),
      prisma.projectProcessStep.findMany({
        where: {
          assignedEmployeeId: dbUser.employeeId,
          scheduledDate: { gte: todayEnd, lt: weekEnd },
          status: { not: "done" },
        },
        include,
        orderBy: { scheduledDate: "asc" },
      }),
      prisma.projectProcessStep.findMany({
        where: {
          assignedEmployeeId: dbUser.employeeId,
          scheduledDate: { lt: todayStart },
          status: { not: "done" },
        },
        include,
        orderBy: { scheduledDate: "asc" },
      }),
    ]);
  }

  // ── Sales responsibilities (salesperson + admin) ──────────────────────
  // Sales don't want production-floor noise, so we surface projects where
  // the `getNextAction` resolver returns a non-terminal action for them.
  let salesResponsibilities: Array<{
    project: { id: string; name: string; jobNumber: string | null; stage: string; isDraft: boolean; updatedAt: string };
    action: { label: string; href: string; reason?: string; tone: string };
    priority: number;
  }> = [];
  let builderTodos: Array<{
    projectId: string;
    projectName: string;
    jobNumber: string | null;
    type: "vanity" | "side_unit";
    roomLabel: string;
  }> = [];

  const seesSales = role === "salesperson" || role === "admin";
  if (seesSales) {
    const salesEmployeeId = dbUser.employeeId ?? null;
    const projects = await prisma.project.findMany({
      where: {
        parentProjectId: null,
        isDone: false,
        // For admin, show all open. For salespeople, prefer the ones they own
        // but fall back to all if they have no ownership linkage yet.
        ...(role === "salesperson" && salesEmployeeId
          ? { salespersonId: salesEmployeeId }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        jobNumber: true,
        stage: true,
        isDraft: true,
        isDone: true,
        types: true,
        clientId: true,
        clientFirstName: true,
        clientLastName: true,
        targetDate: true,
        blockedReason: true,
        sellingPrice: true,
        updatedAt: true,
        vanityInputs: { select: { id: true } },
        sideUnitInputs: { select: { id: true } },
        projectItems: { select: { id: true, type: true, label: true } },
        costLines: { select: { amount: true, kind: true } },
      },
    });

    // Priority: blocking/warning > primary > neutral/success.
    const tonePriority: Record<string, number> = { warning: 0, primary: 1, success: 2, neutral: 3 };

    salesResponsibilities = projects
      .map((p) => {
        const nextProject: NextActionProject = {
          id: p.id,
          isDraft: p.isDraft,
          isDone: p.isDone,
          types: p.types,
          stage: p.stage,
          clientId: p.clientId,
          clientFirstName: p.clientFirstName,
          clientLastName: p.clientLastName,
          targetDate: p.targetDate ? p.targetDate.toISOString() : null,
          projectItems: p.projectItems.map((i) => ({ id: i.id })),
          costLines: p.costLines,
          sellingPrice: p.sellingPrice,
          blockedReason: p.blockedReason,
        };
        const action = getNextAction(nextProject, "salesperson");
        return {
          project: {
            id: p.id,
            name: p.name,
            jobNumber: p.jobNumber,
            stage: p.stage,
            isDraft: p.isDraft,
            updatedAt: p.updatedAt.toISOString(),
          },
          action: {
            label: action.label,
            href: action.href,
            reason: action.reason,
            tone: action.tone,
          },
          priority: tonePriority[action.tone] ?? 99,
          terminal: action.terminal === true,
        };
      })
      .filter((row) => !row.terminal)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 20)
      .map(({ terminal: _t, ...row }) => row);

    // Builder todos — rooms that still need a builder session to finish.
    // These are the "if saved for later, show as a todo" cards.
    for (const p of projects) {
      const hasVanityRoom = p.projectItems.some((i) => i.type === "vanity");
      const hasSideUnitRoom = p.projectItems.some((i) => i.type === "side_unit");
      if (hasVanityRoom && !p.vanityInputs) {
        const vanRoom = p.projectItems.find((i) => i.type === "vanity");
        builderTodos.push({
          projectId: p.id,
          projectName: p.name,
          jobNumber: p.jobNumber,
          type: "vanity",
          roomLabel: vanRoom?.label ?? "Vanity",
        });
      }
      if (hasSideUnitRoom && !p.sideUnitInputs) {
        const suRoom = p.projectItems.find((i) => i.type === "side_unit");
        builderTodos.push({
          projectId: p.id,
          projectName: p.name,
          jobNumber: p.jobNumber,
          type: "side_unit",
          roomLabel: suRoom?.label ?? "Side unit",
        });
      }
    }
    builderTodos = builderTodos.slice(0, 20);
  }

  // ── Planner jobs (planner + admin) ────────────────────────────────────
  // Group today's + overdue production steps by project so the planner sees
  // "job X has 3 unfinished steps, Y is blocking". Blocking = first
  // unfinished step in sortOrder for that project today.
  let plannerJobs: Array<{
    project: { id: string; name: string; jobNumber: string | null };
    blocking: { id: string; label: string } | null;
    steps: Array<{
      id: string;
      label: string;
      status: string;
      sortOrder: number;
      scheduledDate: string | null;
      assignedEmployee: { id: string; name: string; role: string; color: string | null } | null;
      isOverdue: boolean;
    }>;
  }> = [];
  const seesPlanner = role === "planner" || role === "admin";
  if (seesPlanner) {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const steps = await prisma.projectProcessStep.findMany({
      where: {
        OR: [
          { scheduledDate: { gte: todayStart, lt: todayEnd } },
          { scheduledDate: { lt: todayStart }, status: { not: "done" } },
        ],
      },
      include: {
        project: { select: { id: true, name: true, jobNumber: true } },
        assignedEmployee: { select: { id: true, name: true, role: true, color: true } },
      },
      orderBy: [{ projectId: "asc" }, { sortOrder: "asc" }],
    });

    const grouped = new Map<string, typeof plannerJobs[number]>();
    for (const s of steps) {
      const key = s.projectId;
      if (!grouped.has(key)) {
        grouped.set(key, {
          project: s.project,
          blocking: null,
          steps: [],
        });
      }
      const entry = grouped.get(key)!;
      const isOverdue = !!s.scheduledDate && s.scheduledDate < todayStart && s.status !== "done";
      entry.steps.push({
        id: s.id,
        label: s.label,
        status: s.status,
        sortOrder: s.sortOrder,
        scheduledDate: s.scheduledDate ? s.scheduledDate.toISOString() : null,
        assignedEmployee: s.assignedEmployee
          ? { id: s.assignedEmployee.id, name: s.assignedEmployee.name, role: s.assignedEmployee.role, color: s.assignedEmployee.color }
          : null,
        isOverdue,
      });
      if (!entry.blocking && s.status !== "done") {
        entry.blocking = { id: s.id, label: s.label };
      }
    }

    plannerJobs = Array.from(grouped.values()).sort((a, b) => {
      // Jobs with overdue steps first.
      const aOv = a.steps.some((s) => s.isOverdue) ? 0 : 1;
      const bOv = b.steps.some((s) => s.isOverdue) ? 0 : 1;
      if (aOv !== bOv) return aOv - bOv;
      // Then jobs with a blocking step first.
      const aBlock = a.blocking ? 0 : 1;
      const bBlock = b.blocking ? 0 : 1;
      return aBlock - bBlock;
    });
  }

  return NextResponse.json({
    role,
    employee,
    today,
    week,
    overdue,
    salesResponsibilities,
    builderTodos,
    plannerJobs,
  });
}
