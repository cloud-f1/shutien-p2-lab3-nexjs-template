import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import { CodeBlock } from "../ui/CodeBlock";
import type { Components } from "react-markdown";

const components: Components = {
  code({ className, children, node }) {
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children).replace(/\n$/, "");

    // Fenced code block: has language class, or parent is <pre>
    const isBlock = !!match || node?.position?.start.line !== node?.position?.end.line;
    if (isBlock) {
      return <CodeBlock language={match?.[1] ?? ""} code={code} />;
    }

    // Inline code
    return <code className={className}>{children}</code>;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  table({ children }) {
    return (
      <div
        className="overflow-x-auto my-5 rounded-lg"
        style={{ border: "1px solid var(--border)" }}
      >
        <table className="w-full">{children}</table>
      </div>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote
        className="my-5 px-4 py-3 rounded-r-lg"
        style={{
          borderLeft: "3px solid var(--accent)",
          background: "var(--bg2)",
          color: "var(--text2)",
        }}
      >
        {children}
      </blockquote>
    );
  },
};

export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <main className="md:ml-[260px] flex-1 max-w-[860px] px-6 md:px-[60px] pt-14 pb-30">
      <div className="prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug, rehypeRaw]}
          components={components}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </main>
  );
}
