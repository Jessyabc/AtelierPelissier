import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError, RateLimitError } from "openai";
import { prisma } from "@/lib/db";
import { getOpenAIClient, getSystemPrompt } from "@/lib/ai/openai";
import { buildContextMessage } from "@/lib/ai/context";
import { AI_TOOLS, executeFunctionCall } from "@/lib/ai/functions";
import { buildIntentHint } from "@/lib/ai/noteIntelligence";

/**
 * POST /api/ai/chat
 * Processes a chat message with GPT-4o, including context injection and function calling.
 *
 * Body: {
 *   message: string,
 *   conversationId?: string,
 *   pathname: string,
 *   projectId?: string,
 * }
 *
 * Returns: { reply: string, conversationId: string, action?: object }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, conversationId, pathname, projectId } = body;

    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const openai = getOpenAIClient();

    // Get or create conversation
    let convoId = conversationId;
    if (!convoId) {
      const conversation = await prisma.aiConversation.create({
        data: {
          projectId: projectId || null,
          scope: projectId ? "project" : "global",
        },
      });
      convoId = conversation.id;
    }

    // Load conversation history
    const history = await prisma.aiMessage.findMany({
      where: { conversationId: convoId },
      orderBy: { createdAt: "asc" },
      take: 30,
    });

    // Build context
    const contextMessage = await buildContextMessage({
      pathname: pathname ?? "/",
      projectId,
    });

    // Pre-parse intent hints from the user's message
    const intentHint = await buildIntentHint(message);

    // Assemble messages for OpenAI
    const systemPrompt = await getSystemPrompt();
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: `Current context:\n${contextMessage}` },
    ];

    if (intentHint) {
      messages.push({ role: "system", content: `[Note intelligence hint: ${intentHint}]` });
    }

    // If user message looks like confirmation and last assistant reply was about Monday/proposal, force tool-call hint
    const lastAssistant = history.filter((m: { role: string }) => m.role === "assistant").pop();
    const lastContent = lastAssistant?.content ?? "";
    const looksLikeConfirmation = /^(yes|confirm|ok|go ahead|do it|approved|oui|d'accord|sure|please do|go for it|confirmed?|I confirm|let's do it|do them)$/i.test(message.trim());
    const lastWasMondayProposal = /monday|proposed?|approv|create.*project|draft project/i.test(lastContent);
    if (looksLikeConfirmation && lastWasMondayProposal) {
      messages.push({
        role: "system",
        content:
          "[User is confirming.] You MUST call listMondayItems to get the current board and item IDs, then call createProjectsFromMondayItems with that boardId and the itemIds so an Approve button appears. Do not reply with only text.",
      });
    }

    // Add history
    for (const msg of history) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }

    // Add current message
    messages.push({ role: "user", content: message });

    // Save user message
    await prisma.aiMessage.create({
      data: {
        conversationId: convoId,
        role: "user",
        content: message,
      },
    });

    // Call OpenAI with function calling
    let finalReply = "";
    let actionPayload: Record<string, unknown> | null = null;
    let maxIterations = 5; // prevent infinite loops

    let currentMessages = [...messages];

    while (maxIterations > 0) {
      maxIterations--;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: currentMessages as Parameters<typeof openai.chat.completions.create>[0]["messages"],
        tools: AI_TOOLS,
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 1500,
      });

      const choice = completion.choices[0];
      if (!choice) break;

      const assistantMsg = choice.message;

      // If the model wants to call a function
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        // Add assistant message with tool calls to the conversation
        currentMessages.push(assistantMsg as unknown as typeof currentMessages[0]);

        // Collect multiple createProjectFromMondayItem calls into one batch action
        const mondayBatch: { boardId: string; itemId: string }[] = [];

        for (const toolCall of assistantMsg.tool_calls) {
          const tc = toolCall as unknown as Record<string, Record<string, string>>;
          const fnName = tc.function?.name ?? "";
          const rawArgs = tc.function?.arguments ?? "{}";
          let fnArgs: Record<string, unknown>;
          try {
            fnArgs = JSON.parse(rawArgs) as Record<string, unknown>;
          } catch {
            const callIdBad = (toolCall as unknown as { id: string }).id;
            currentMessages.push({
              role: "tool" as unknown as "user",
              tool_call_id: callIdBad,
              content: JSON.stringify({
                error: "invalid_json_arguments",
                message: "Could not parse tool arguments as JSON; retry with valid JSON only.",
              }),
            } as unknown as typeof currentMessages[0]);
            continue;
          }

          const fnResult = await executeFunctionCall(fnName, fnArgs);

          if (fnResult.isAction && fnResult.actionPayload) {
            const p = fnResult.actionPayload;
            if (p.action === "createProjectFromMonday" && p.boardId && p.itemId) {
              mondayBatch.push({ boardId: p.boardId as string, itemId: p.itemId as string });
            } else {
              actionPayload = p;
            }
          }

          const callId = (toolCall as unknown as { id: string }).id;
          currentMessages.push({
            role: "tool" as unknown as "user",
            tool_call_id: callId,
            content: fnResult.result,
          } as unknown as typeof currentMessages[0]);
        }

        if (mondayBatch.length > 0) {
          actionPayload =
            mondayBatch.length === 1
              ? { action: "createProjectFromMonday", boardId: mondayBatch[0].boardId, itemId: mondayBatch[0].itemId }
              : { action: "createProjectFromMonday", items: mondayBatch };
        }

        continue;
      }

      // Model gave a text response — we're done
      finalReply = assistantMsg.content ?? "";
      break;
    }

    if (!finalReply.trim()) {
      finalReply =
        "I couldn’t produce a reply (tools may still have run). Please rephrase your question or try again in a moment.";
    }

    // Save assistant reply and capture id for action approval
    const assistantMsg = await prisma.aiMessage.create({
      data: {
        conversationId: convoId,
        role: "assistant",
        content: finalReply,
        functionCall: actionPayload ? JSON.stringify(actionPayload) : null,
        actionStatus: actionPayload ? "pending" : null,
      },
    });

    // Update conversation timestamp
    await prisma.aiConversation.update({
      where: { id: convoId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      reply: finalReply,
      conversationId: convoId,
      messageId: assistantMsg.id,
      action: actionPayload,
    });
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
