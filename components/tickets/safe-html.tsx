import { renderMarkdown } from "@/lib/markdown";

/**
 * The ONE sanitiser component (security.md A05). Renders markdown through remark → rehype-sanitize (strict
 * schema) and injects the resulting HTML. Everything else in the app uses React escaping.
 */
export async function SafeHtml({ markdown, html, className }: { markdown: string; html?: string | null; className?: string }) {
  const safe = html ?? (await renderMarkdown(markdown));
  // The only dangerouslySetInnerHTML in the codebase: input is sanitised by rehype-sanitize (allowlisted tags/attrs/protocols).
  return <div className={`prose-ticket ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: safe }} />;
}
