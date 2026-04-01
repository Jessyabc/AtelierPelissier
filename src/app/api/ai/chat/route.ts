import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError, RateLimitError } from "openai";
import { prisma } from "@/lib/db";
import { getOpenAIClient, getSystemPrompt } from "@/lib/ai/openai";
import { buildContextMessage } from "@/lib/ai/context";
import { buildIntentHint } from "@/lib/ai/noteIntelligence";
import { getSessionWithUser } from "@/lib/auth/session";
import { runToolLoop } from "@/lib/ai/runChatTurn";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/ai/chat
 * Body: { message, conversationId?, pathname?, projectId?, stream?: boolean }
 *
 * Default: JSON { reply, conversationId, messageId, action? }
 * stream: true → text/event-stream with SSE JSON events (start, phase, delta, done | error)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getSessionWithUser();
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { message, conversationId, pathname, projectId, stream: wantStream } = body;

    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const openai = getOpenAIClient();
    const model = (process.env.OPENAI_MODEL ?? "gpt-4o").trim();

    let convoId = conversationId as string | undefined;
    if (!convoId) {
      const conversation = await prisma.aiConversation.create({
        data: {
          projectId: projectId || null,
          scope: projectId ? "project" : "global",
        },
      });
      convoId = conversation.id;
    }

    const history = await prisma.aiMessage.findMany({
      where: { conversationId: convoId },
      orderBy: { createdAt: "asc" },
      take: 30,
    });

    const contextMessage = await buildContextMessage({
      pathname: pathname ?? "/",
      projectId,
    });

    const intentHint = await buildIntentHint(message);

    const systemPrompt = await getSystemPrompt();
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: `Current context:\n${contextMessage}` },
    ];

    if (intentHint) {
      messages.push({ role: "system", content: `[Note intelligence hint: ${intentHint}]` });
    }

    const lastAssistant = history.filter((m: { role: string }) => m.role === "assistant").pop();
    const lastContent = lastAssistant?.content ?? "";
    const looksLikeConfirmation = /^(yes|confirm|ok|go ahead|do it|approved|oui|d'accord|sure|please do|go for it|confirmed?|I confirm|let's do it|do them)$/i.test(
      String(message).trim()
    );
    const lastWasMondayProposal = /monday|proposed?|approv|create.*project|draft project/i.test(lastContent);
    if (looksLikeConfirmation && lastWasMondayProposal) {
      messages.push({
        role: "system",
        content:
          "[User is confirming.] You MUST call listMondayItems to get the current board and item IDs, then call createProjectsFromMondayItems with that boardId and the itemIds so an Approve button appears. Do not reply with only text.",
      });
    }

    for (const msg of history) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }

    messages.push({ role: "user", content: message });

    await prisma.aiMessage.create({
      data: {
        conversationId: convoId,
        role: "user",
        content: message,
      },
    });

    const encoder = new TextEncoder();
    const sse = (obj: object) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

    async function persistAndReturnJson(finalReply: string, actionPayload: Record<string, unknown> | null) {
      let reply = finalReply.trim();
      if (!reply) {
        reply =
          "I couldn’t produce a reply (tools may still have run). Please rephrase your question or try again in a moment.";
      }

      const assistantMsg = await prisma.aiMessage.create({
        data: {
          conversationId: convoId!,
          role: "assistant",
          content: reply,
          functionCall: actionPayload ? JSON.stringify(actionPayload) : null,
          actionStatus: actionPayload ? "pending" : null,
        },
      });

      await prisma.aiConversation.update({
        where: { id: convoId! },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({
        reply,
        conversationId: convoId,
        messageId: assistantMsg.id,
        action: actionPayload,
      });
    }

    if (wantStream === true) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(sse({ type: "start", conversationId: convoId }));

            const { finalReply, actionPayload } = await runToolLoop({
              openai,
              model,
              messages,
              onPhase: (phase) => {
                controller.enqueue(sse({ type: "phase", phase }));
              },
            });

            let reply = finalReply.trim();
            if (!reply) {
              reply =
                "I couldn’t produce a reply (tools may still have run). Please rephrase your question or try again in a moment.";
            }

            controller.enqueue(sse({ type: "phase", phase: "reply" }));
            const CHUNK = 40;
            for (let i = 0; i < reply.length; i += CHUNK) {
              controller.enqueue(sse({ type: "delta", text: reply.slice(i, i + CHUNK) }));
            }

            const assistantMsg = await prisma.aiMessage.create({
              data: {
                conversationId: convoId!,
                role: "assistant",
                content: reply,
                functionCall: actionPayload ? JSON.stringify(actionPayload) : null,
                actionStatus: actionPayload ? "pending" : null,
              },
            });

            await prisma.aiConversation.update({
              where: { id: convoId! },
              data: { updatedAt: new Date() },
            });

            controller.enqueue(
              sse({
                type: "done",
                messageId: assistantMsg.id,
                conversationId: convoId!,
                action: actionPayload,
              })
            );
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            controller.enqueue(sse({ type: "error", message: msg }));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const { finalReply, actionPayload } = await runToolLoop({
      openai,
      model,
      messages,
    });

    return persistAndReturnJson(finalReply, actionPayload);
  } catch (err) {
    console.error("POST /api/ai/chat error:", err);

    if (err instanceof AuthenticationError) {
      return NextResponse.json(
        {
          error: "OpenAI rejected this API key.",
          details:
            "Update OPENAI_API_KEY in .env.local and restart `npm run dev` (or redeploy). The key may be invalid or revoked.",
        },
        { status: 401 }
      );
    }

    if (err instanceof RateLimitError) {
      return NextResponse.json(
        {
          error: "OpenAI rate limit reached.",
          details: "Wait a short time and try again, or check usage on your OpenAI account.",
        },
        { status: 429 }
      );
    }

    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    if (errorMessage.includes("OPENAI_API_KEY")) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Add OPENAI_API_KEY to .env.local" },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "AI chat failed", details: errorMessage }, { status: 500 });
  }
}
