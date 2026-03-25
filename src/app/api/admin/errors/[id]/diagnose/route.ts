import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

const APP_ARCHITECTURE = `
# Atelier Pelissier — Architecture Summary

**Stack:** Next.js 14 (App Router) + Prisma ORM + SQLite + OpenAI GPT-4o

**Key Modules:**
- Operations Cockpit (/home): project health, shortages, orders, deviations
- Project Management: wizard creation, timeline-first detail, room-based items
- AI Assistant (/assistant): context-aware chat with function calling + action queue
- Inventory: stock tracking, material requirements, shortage detection
- Suppliers & Purchasing (/distributors): catalog, orders, receiving with deviation log
- Observability Engine: recalculates financial, material, inventory, and order risk
- Admin Hub (/admin): centralized app configuration, error diagnostics

**Data Flow:**
Project → Rooms (ProjectItems) → CutList (PanelParts) → MaterialRequirements
→ InventoryItem comparison → Shortage detection → Order drafts → Receiving → StockMovements
→ Deviation logging → Dashboard/Cockpit alerts

**Key Models:** Project, ProjectItem, Client, InventoryItem, Supplier, SupplierCatalogItem,
Order, OrderLine, MaterialRequirement, Deviation, AppConfig, AppErrorLog,
AiConversation, AiMessage, ProcessTemplate, ProcessStep
`.trim();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireRole(["admin"]);
  if (!session.ok) return session.response;

  const { id } = await params;

  const errorLog = await prisma.appErrorLog.findUnique({ where: { id } });
  if (!errorLog) {
    return NextResponse.json({ error: "Error not found" }, { status: 404 });
  }

  const contextObj = errorLog.context ? JSON.parse(errorLog.context) : {};

  const diagnosticPrompt = `You are debugging an error in a production woodshop management application.

## Error Details
- **Source:** ${errorLog.source}
- **Severity:** ${errorLog.severity}
- **Message:** ${errorLog.message}
- **Route:** ${errorLog.route || "Unknown"}
- **Timestamp:** ${errorLog.createdAt.toISOString()}
${errorLog.stack ? `\n## Stack Trace\n\`\`\`\n${errorLog.stack}\n\`\`\`` : ""}
${Object.keys(contextObj).length > 0 ? `\n## Context\n\`\`\`json\n${JSON.stringify(contextObj, null, 2)}\n\`\`\`` : ""}

## Application Architecture
${APP_ARCHITECTURE}

## Your Task
1. Analyze the error and identify the most likely root cause
2. Explain what triggered the error in plain language
3. Propose a concrete fix with code changes (file paths and specific edits)
4. Note any related areas that should be checked for similar issues
5. Rate the severity: is this blocking functionality, or cosmetic?

Be specific — reference actual file paths based on the architecture above.`;

  await prisma.appErrorLog.update({
    where: { id },
    data: { aiDiagnosticPrompt: diagnosticPrompt },
  });

  return NextResponse.json({ id, diagnosticPrompt });
}
