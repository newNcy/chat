"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/chat/code-block";

interface MarkdownProps {
  content: string;
}

/** 从 className（language-xxx）中提取语言 */
function extractLanguage(className?: string): string {
  if (!className) return "";
  const match = /language-(\w+)/.exec(className);
  return match?.[1] ?? "";
}

const components: Components = {
  code({ className, children, ...props }) {
    const language = extractLanguage(className);
    const raw = String(children ?? "");
    // 有语言标记或包含换行 => 视为代码块
    const isBlock = Boolean(language) || raw.includes("\n");

    if (!isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    const value = raw.replace(/\n$/, "");
    return <CodeBlock language={language} value={value} />;
  },
  // 避免 <pre> 再包裹一层，交给 CodeBlock 自行处理
  pre({ children }) {
    return <>{children}</>;
  },
  a({ children, ...props }) {
    return (
      <a target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

export const Markdown = React.memo(function Markdown({
  content,
}: MarkdownProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
