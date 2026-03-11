"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AiMessageBubble } from "@/components/ai/AiMessageBubble";
import { AiActionCard } from "@/components/ai/AiActionCard";

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  action?: { action: string; [key: string]: unknown } | null;
  actionStatus?: string | null;
};

type Conversation = {
  id: string;
  scope: string;
  projectId: string | null;
  updatedAt: string;
  project?: { name: string; jobNumber: string | null } | null;
  messages: { id: string; role: string; content: string; functionCall: string | null; actionStatus: string | null; createdAt: string }[];
};

const QUICK_ACTIONS = [
  { id: "email-supplier", icon: "✉", label: "Email Supplier", description: "Draft an order or reservation email for a supplier", prompt: "I need to email a supplier. Help me draft it." },
  { id: "check-inventory", icon: "📦", label: "Check Inventory", description: "See current stock levels and shortages", prompt: "Show me current inventory status and any shortages." },
  { id: "project-status", icon: "📋", label: "Project Status", description: "Get a health check on any project", prompt: "Give me the status of my active projects." },
  { id: "add-material", icon: "➕", label: "Add Material", description: "Add materials to a project's requirements", prompt: "I need to add materials to a project." },
  { id: "order-material", icon: "🛒", label: "Order Material", description: "Create a purchase order or reservation", prompt: "I need to order materials." },
  { id: "find-shortage", icon: "⚠", label: "Find Shortages", description: "Check what materials are short across projects", prompt: "What materials are we short on?" },
  { id: "borrow-stock", icon: "🔄", label: "Borrow Stock", description: "Check if material can be borrowed from another project", prompt: "Can I borrow material from another project?" },
  { id: "email-client", icon: "👤", label: "Email Client", description: "Draft a follow-up or update email for a client", prompt: "Help me draft an email to a client." },
];

export default function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [showActions, setShowActions] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approvingIndex, setApprovingIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/conversations");
      if (res.ok) setConversations(await res.json());
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  function openConversation(convo: Conversation) {
    setActiveConvoId(convo.id);
    setMessages(
      convo.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          action: m.functionCall ? JSON.parse(m.functionCall) : null,
          actionStatus: m.actionStatus,
        }))
    );
    setShowActions(false);
  }

  function startNewChat() {
    setActiveConvoId(null);
    setMessages([]);
    setShowActions(true);
  }

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = text ?? input.trim();
    if (!msgText || loading) return;

    const userMsg: Message = { role: "user", content: msgText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setActionError(null);
    setLoading(true);
    setShowActions(false);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msgText,
          conversationId: activeConvoId,
          pathname: "/assistant",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error ?? "Something went wrong.";
        setMessages((prev) => [...prev, { role: "assistant", content: data.details ? `${errMsg}: ${data.details}` : errMsg }]);
        return;
      }
      if (data.conversationId && !activeConvoId) setActiveConvoId(data.conversationId);
      setMessages((prev) => [...prev, {
        id: data.messageId,
        role: "assistant",
        content: data.reply,
        action: data.action ?? null,
        actionStatus: data.action ? "pending" : null,
      }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to connect." }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, activeConvoId]);

  async function handleActionApprove(idx: number, approved: boolean) {
    const msg = messages[idx];
    setActionError(null);
    if (!msg?.id) {
      setActionError("Cannot approve: message ID missing. Try sending your request again.");
      return;
    }
    if (approvingIndex !== null) return;
    setApprovingIndex(idx);
    try {
      const res = await fetch(`/api/ai/actions/${msg.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.details ? `${data.error ?? "Approval failed"}: ${data.details}` : (data.error ?? "Approval failed"));
        return;
      }
      setMessages((prev) => prev.map((m, i) =>
        i === idx ? { ...m, actionStatus: approved ? "executed" : "rejected" } : m
      ));
      if (approved && data.result?.mailto) window.open(data.result.mailto, "_blank");
      if (approved && data.result?.projectId && (data.result?.count ?? 1) > 0) {
        const count = data.result?.count ?? 1;
        if (count > 1) window.location.href = "/projects";
        else window.location.href = `/projects/${data.result.projectId}`;
      } else if (approved && data.result && (data.result?.total ?? 0) > 0 && (data.result?.count ?? 0) === 0) {
        setActionError(data.result?.errors?.length ? `None created: ${(data.result.errors as string[]).join("; ")}` : "No projects were created. Check Monday API key and board.");
      } else if (approved && data.result?.errors?.length) {
        setActionError(`Partial: ${data.result?.count ?? 0} created. ${(data.result.errors as string[]).join("; ")}`);
      }
    } catch (e) {
      setActionError("Network or server error. Check the console.");
      console.error("Approve error:", e);
    } finally {
      setApprovingIndex(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasChat = messages.length > 0;

  return (
    <div className="max-w-4xl mx-auto flex flex-col" style={{ height: "calc(100vh - 100px)" }}>
      {/* Top bar: session list + new chat */}
      <div className="flex items-center justify-between py-2 flex-shrink-0">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">AI Assistant</h1>
        <div className="flex items-center gap-2">
          {hasChat && (
            <button onClick={startNewChat} className="neo-btn px-3 py-1.5 text-xs">
              New Chat
            </button>
          )}
          <ConversationDropdown
            conversations={conversations}
            loading={loadingConvos}
            onSelect={openConversation}
            activeId={activeConvoId}
          />
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2">
        {!hasChat && showActions ? (
          /* Welcome state with centered prompt */
          <div className="flex flex-col items-center justify-center min-h-full py-8">
            <div className="text-center mb-8 max-w-md">
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                How can I help?
              </h2>
              <p className="text-sm text-[var(--foreground-muted)]">
                Ask me anything about your projects, inventory, orders, or use a quick action below.
              </p>
            </div>

            {/* Input in the center */}
            <div className="w-full max-w-lg mb-10">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything or describe what you need..."
                  className="neo-input flex-1 px-4 py-3 text-sm"
                  autoFocus
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="neo-btn-primary px-4 py-3 text-sm font-medium disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Quick Actions grid */}
            <div ref={actionsRef} className="w-full max-w-2xl">
              <h3 className="text-sm font-semibold text-[var(--foreground-muted)] mb-3 text-center">
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => sendMessage(action.prompt)}
                    className="neo-card p-3 text-left hover:translate-y-[-2px] transition-transform"
                  >
                    <div className="text-lg mb-1">{action.icon}</div>
                    <div className="text-xs font-semibold text-[var(--foreground)]">{action.label}</div>
                    <div className="text-[10px] text-[var(--foreground-muted)] mt-0.5 leading-tight">
                      {action.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Active conversation */
          <div className="space-y-3 py-4">
            {messages.map((msg, i) => (
              <div key={i}>
                <AiMessageBubble role={msg.role} content={msg.content} />
                {msg.action && (msg.actionStatus === "pending" || msg.actionStatus === "executing") && (
                  <AiActionCard
                    action={msg.action}
                    onApprove={() => handleActionApprove(i, true)}
                    onReject={() => handleActionApprove(i, false)}
                    isExecuting={approvingIndex === i || msg.actionStatus === "executing"}
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
            {actionError && (
              <div className="ml-2 mt-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                {actionError}
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                Thinking...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom input bar (when in active chat) */}
      {hasChat && (
        <div className="py-3 flex-shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Continue the conversation..."
              className="neo-input flex-1 px-4 py-3 text-sm"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="neo-btn-primary px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationDropdown({
  conversations,
  loading,
  onSelect,
  activeId,
}: {
  conversations: Conversation[];
  loading: boolean;
  onSelect: (c: Conversation) => void;
  activeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOut);
    return () => document.removeEventListener("mousedown", handleOut);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="neo-btn px-3 py-1.5 text-xs flex items-center gap-1"
      >
        History
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l3 3 3-3" /></svg>
      </button>
      {open && (
        <div className="neo-dropdown absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto z-50 py-1">
          {loading && <div className="px-3 py-2 text-xs text-[var(--foreground-muted)]">Loading...</div>}
          {!loading && conversations.length === 0 && (
            <div className="px-3 py-2 text-xs text-[var(--foreground-muted)]">No conversations yet</div>
          )}
          {conversations.map((c) => {
            const firstMsg = c.messages.find((m) => m.role === "user")?.content ?? "Empty";
            const preview = firstMsg.length > 60 ? firstMsg.slice(0, 60) + "..." : firstMsg;
            const isActive = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => { onSelect(c); setOpen(false); }}
                className={`block w-full text-left px-3 py-2 text-xs hover:bg-white/50 transition-colors ${isActive ? "bg-white/60 font-medium" : ""}`}
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[var(--foreground)] truncate">{preview}</span>
                  <span className="text-[var(--foreground-muted)] flex-shrink-0">
                    {c.scope === "project" && c.project ? c.project.jobNumber ?? c.project.name : "Global"}
                  </span>
                </div>
                <div className="text-[var(--foreground-muted)] mt-0.5">
                  {new Date(c.updatedAt).toLocaleDateString("en-CA")} — {c.messages.length} messages
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
