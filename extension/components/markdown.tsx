import React from "react";

interface MarkdownTextProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export const MarkdownText = ({ content, className = "", style }: MarkdownTextProps) => {
  const html = render(content);
  return (
    <div
      className={`markdown-text ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

function render(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:var(--g-surface-dim);border:1px solid var(--g-outline-variant);border-radius:8px;padding:8px 10px;margin:4px 0;font-size:11px;overflow-x:auto"><code>$2</code></pre>');
  out = out.replace(/`([^`]+)`/g, '<code style="background:var(--g-surface-container);padding:1px 4px;border-radius:4px;font-size:11px">$1</code>');
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  out = out.replace(/^### (.+)$/gm, '<div style="font-size:13px;font-weight:600;margin-top:8px;margin-bottom:2px">$1</div>');
  out = out.replace(/^## (.+)$/gm, '<div style="font-size:14px;font-weight:600;margin-top:8px;margin-bottom:2px">$1</div>');
  out = out.replace(/^# (.+)$/gm, '<div style="font-size:15px;font-weight:700;margin-top:8px;margin-bottom:2px">$1</div>');
  out = out.replace(/^- (.+)$/gm, '<div style="padding-left:12px">&#x2022; $1</div>');
  out = out.replace(/\n/g, "<br/>");
  return out;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
