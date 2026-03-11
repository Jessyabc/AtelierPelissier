"use client";

export function AiMessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
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
      </div>
    </div>
  );
}
