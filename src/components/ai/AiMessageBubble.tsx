"use client";

export function AiMessageBubble({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  /** Show a typing cursor while tokens stream in */
  streaming?: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-br-sm text-sm bg-[var(--accent)] text-white">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-bl-sm text-sm neo-card-accent whitespace-pre-wrap">
        {content}
        {streaming && (
          <span className="inline-block w-2 h-4 ml-0.5 align-text-bottom bg-[var(--accent)]/70 animate-pulse rounded-sm" aria-hidden />
        )}
      </div>
    </div>
  );
}
