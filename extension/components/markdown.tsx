import React from "react";

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export const MarkdownText = ({ content, className = "" }: MarkdownTextProps) => {
  const html = render(content);
  return (
    <div
      className={`markdown-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

function render(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-900 rounded px-2 py-1.5 my-1 text-[10px] overflow-x-auto"><code>$2</code></pre>');
  out = out.replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded text-[10px]">$1</code>');
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  out = out.replace(/^### (.+)$/gm, '<div class="text-xs font-semibold mt-2 mb-0.5">$1</div>');
  out = out.replace(/^## (.+)$/gm, '<div class="text-sm font-semibold mt-2 mb-0.5">$1</div>');
  out = out.replace(/^# (.+)$/gm, '<div class="text-sm font-bold mt-2 mb-0.5">$1</div>');
  out = out.replace(/^- (.+)$/gm, '<div class="pl-3 before:content-[\'•\'] before:mr-1.5 before:text-gray-600">$1</div>');
  out = out.replace(/\n/g, "<br/>");
  return out;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
