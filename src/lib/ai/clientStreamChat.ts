export type StreamChatCallbacks = {
  onStart: (conversationId: string) => void;
  onPhase: (phase: "thinking" | "using_tools" | "reply") => void;
  onDelta: (text: string) => void;
  onDone: (payload: { messageId: string; conversationId: string; action: Record<string, unknown> | null }) => void;
  onError: (message: string) => void;
};

/**
 * POST /api/ai/chat with stream: true; consumes SSE `data: {json}` frames.
 */
export async function streamAiChat(body: Record<string, unknown>, cbs: StreamChatCallbacks): Promise<void> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
  });

  const ct = res.headers.get("content-type") ?? "";

  if (!res.ok || !ct.includes("text/event-stream")) {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { error?: string; details?: string };
      cbs.onError(j.details ? `${j.error ?? "Error"}: ${j.details}` : (j.error ?? text.slice(0, 280)));
    } catch {
      cbs.onError(text.slice(0, 280) || `Request failed (${res.status})`);
    }
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    cbs.onError("No response body");
    return;
  }

  const dec = new TextDecoder();
  let carry = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += dec.decode(value, { stream: true });
    const parts = carry.split("\n\n");
    carry = parts.pop() ?? "";

    for (const block of parts) {
      const line = block.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue;
      }
      const t = data.type as string;
      if (t === "start" && typeof data.conversationId === "string") {
        cbs.onStart(data.conversationId);
      } else if (t === "phase" && typeof data.phase === "string") {
        const p = data.phase;
        if (p === "thinking" || p === "using_tools" || p === "reply") cbs.onPhase(p);
      } else if (t === "delta" && typeof data.text === "string") {
        cbs.onDelta(data.text);
      } else if (t === "done") {
        cbs.onDone({
          messageId: String(data.messageId ?? ""),
          conversationId: String(data.conversationId ?? ""),
          action: (data.action as Record<string, unknown> | null) ?? null,
        });
      } else if (t === "error" && typeof data.message === "string") {
        cbs.onError(data.message);
      }
    }
  }
}
