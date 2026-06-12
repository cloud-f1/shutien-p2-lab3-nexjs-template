import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface ProseProps {
  /** Long-form content to render with type-scale defaults. */
  children: ReactNode;
  /** Override the rendered element. Defaults to `<article>`. */
  as?: "article" | "div" | "section";
  /** Extra class merged onto the outer element. */
  className?: string;
}

/**
 * Long-form text wrapper with explicit type-scale (headings, paragraphs,
 * lists, code, links). Used by Privacy/Terms and any future docs-style
 * page. All visuals come from `prose.shell`.
 */
export function Prose({ children, as = "article", className = "" }: ProseProps) {
  const p = getActivePreset().prose;
  const Tag = as;

  return <Tag className={[p.shell, className].join(" ").trim()}>{children}</Tag>;
}
