import type OpenAI from "openai";
import { AI_TOOLS, executeFunctionCall } from "@/lib/ai/functions";

export type ChatTurnPhase = "thinking" | "using_tools";

export type RunToolLoopParams = {
  openai: OpenAI;
  model: string;
  /** Initial messages (system + user + history + new user message). Mutated: tool rounds append assistant + tool messages. */
  messages: unknown[];
  onPhase?: (phase: ChatTurnPhase) => void;
  maxIterations?: number;
};

export type RunToolLoopResult = {
  finalReply: string;
  actionPayload: Record<string, unknown> | null;
};

/**
 * OpenAI chat with tools until the model returns text (no tool_calls) or iterations exhausted.
 */
export async function runToolLoop(params: RunToolLoopParams): Promise<RunToolLoopResult> {
  const { openai, model, messages, onPhase, maxIterations = 5 } = params;
  let actionPayload: Record<string, unknown> | null = null;
  let currentMessages = [...params.messages] as Parameters<typeof openai.chat.completions.create>[0]["messages"];

  let iterations = maxIterations;
  while (iterations > 0) {
    iterations--;
    onPhase?.("thinking");

    const completion = await openai.chat.completions.create({
      model,
      messages: currentMessages,
      tools: AI_TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 1500,
    });

    const choice = completion.choices[0];
    if (!choice) break;

    const assistantMsg = choice.message;

    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      onPhase?.("using_tools");
      currentMessages.push(assistantMsg as unknown as (typeof currentMessages)[0]);

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
          } as unknown as (typeof currentMessages)[0]);
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
        } as unknown as (typeof currentMessages)[0]);
      }

      if (mondayBatch.length > 0) {
        actionPayload =
          mondayBatch.length === 1
            ? { action: "createProjectFromMonday", boardId: mondayBatch[0].boardId, itemId: mondayBatch[0].itemId }
            : { action: "createProjectFromMonday", items: mondayBatch };
      }

      continue;
    }

    const finalReply = assistantMsg.content ?? "";
    return { finalReply, actionPayload };
  }

  return {
    finalReply:
      "I couldn’t finish the reply (too many tool steps). Please rephrase or try again in a moment.",
    actionPayload,
  };
}
