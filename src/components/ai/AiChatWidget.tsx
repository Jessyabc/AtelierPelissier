"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { AiMessageBubble } from "./AiMessageBubble";
import { AiActionCard } from "./AiActionCard";

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  action?: {
    action: string;
    [key: string]: unknown;
  } | null;
  actionStatus?: string | null;
};

export function AiChatWidget() {
  const pathname = usePathname();

  // Don't render on the dedicated AI Assistant page
  if (pathname === "/assistant") return null;
  if (pathname === "/login" || pathname?.startsWith("/auth")) return null;

  return <AiChatWidgetInner pathname={pathname} />;
}

function AiChatWidgetInner({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvingMessageIndex, setApprovingMessageIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Extract projectId from pathname if on a project page
  const projectIdMatch = pathname.match(/\/projects\/([^/]+)/);
  const projectId = projectIdMatch?.[1] ?? undefined;

  // Persist last visited project so the /assistant page can pick it up
  useEffect(() => {
    if (projectId) {
      localStorage.setItem("ap_last_project_id", projectId);
    }
  }, [projectId]);

  // Reset conversation when navigating to a different project
  const lastProjectRef = useRef(projectId);
  useEffect(() => {
    if (projectId !== lastProjectRef.current) {
      // Only reset if switching projects (not just navigating away)
      if (projectId && lastProjectRef.current && projectId !== lastProjectRef.current) {
        setMessages([]);
        setConversationId(null);
      }
      lastProjectRef.current = projectId;
    }
  }, [projectId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          conversationId,
          pathname,
          projectId,
        }),
      });

      const raw = await res.text();
      let data: {
        error?: string;
        details?: string;
        reply?: string;
        conversationId?: string;
        messageId?: string;
        action?: Message["action"];
      };
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        setError(
          res.ok
            ? "The server returned an invalid response. Try again or check the dev console."
            : `Server error (${res.status}): ${raw.slice(0, 280)}`
        );
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const msg = data.error ?? "Chat failed";
        setError(data.details ? `${msg}: ${data.details}` : msg);
        setLoading(false);
        return;
      }

      if (data.conversationId) setConversationId(data.conversationId);

      const assistantMsg: Message = {
        id: data.messageId,
        role: "assistant",
        content: data.reply?.trim() ? data.reply : "No reply returned. Try asking again.",
        action: data.action ?? null,
        actionStatus: data.action ? "pending" : null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Failed to connect to AI");
    } finally {
      setLoading(false);
    }
  }, [input, loading, conversationId, pathname, projectId]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function handleActionApprove(messageIndex: number, approved: boolean) {
    const msg = messages[messageIndex];
    if (!msg?.id) {
      setError("Cannot approve: try sending your request again.");
      return;
    }
    if (approvingMessageIndex !== null) return;
    setApprovingMessageIndex(messageIndex);
    setError(null);
    try {
      const res = await fetch(`/api/ai/actions/${msg.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.details ? `${data.error ?? "Approval failed"}: ${data.details}` : (data.error ?? "Approval failed"));
        return;
      }

      setMessages((prev) =>
        prev.map((m, i) =>
          i === messageIndex
            ? { ...m, actionStatus: approved ? "executed" : "rejected" }
            : m
        )
      );

      if (approved && data.result?.mailto) {
        window.open(data.result.mailto, "_blank");
      }
      if (approved && data.result?.projectId && (data.result?.count ?? 1) > 0) {
        const count = data.result?.count ?? 1;
        if (count > 1) window.location.href = "/projects";
        else window.location.href = `/projects/${data.result.projectId}`;
      } else if (approved && data.result && (data.result?.total ?? 0) > 0 && (data.result?.count ?? 0) === 0) {
        setError(data.result?.errors?.length ? (data.result.errors as string[]).join("; ") : "No projects were created. Check Monday API key.");
      }
    } catch (e) {
      console.error("Action approval failed", e);
      setError("Approval request failed. Check the console.");
    } finally {
      setApprovingMessageIndex(null);
    }
  }

  function handleNewConversation() {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }

  return (
    <>
      {/* Floating Bubble */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full neo-btn-primary flex items-center justify-center text-white text-xl shadow-lg transition-transform hover:scale-105"
        aria-label="AI Assistant"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-8rem)] flex flex-col neo-card overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--shadow-dark)]/20 flex items-center justify-between flex-shrink-0 bg-[var(--bg-raised)]">
            <div>
              <div className="font-semibold text-sm text-[var(--foreground)]">AI Assistant</div>
              <div className="text-[10px] text-[var(--foreground-muted)]">
                {projectId ? "Project-scoped" : "Global"} context
              </div>
            </div>
            <button
              onClick={handleNewConversation}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              New chat
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="text-center text-sm text-[var(--foreground-muted)] py-8">
                <p className="font-medium mb-1">How can I help?</p>
                <p className="text-xs">
                  Ask about project status, inventory, shortages, or say things
                  like &quot;add 2 white melamines&quot;
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                <AiMessageBubble role={msg.role} content={msg.content} />
                {msg.action && (msg.actionStatus === "pending" || msg.actionStatus === "executing") && (
                  <AiActionCard
                    action={msg.action}
                    onApprove={() => handleActionApprove(i, true)}
                    onReject={() => handleActionApprove(i, false)}
                    isExecuting={approvingMessageIndex === i || msg.actionStatus === "executing"}
                  />
                )}
                {msg.actionStatus === "executed" && (
                  <div className="ml-2 mt-1 text-xs text-emerald-600 font-medium">Action executed</div>
                )}
                {msg.actionStatus === "rejected" && (
                  <div className="ml-2 mt-1 text-xs text-[var(--foreground-muted)]">Action rejected</div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                Thinking...
              </div>
            )}

            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[var(--shadow-dark)]/20 flex-shrink-0">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                className="neo-input flex-1 px-3 py-2.5 text-sm"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="neo-btn-primary px-3 py-2.5 text-sm font-medium disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
