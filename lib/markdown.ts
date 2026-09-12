import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

/**
 * Markdown-lite for tickets/comments (ADR-08, security.md A05). Strict sanitiser schema:
 * no raw HTML, no javascript:/data: links, no images except our own storage host, rel=noopener on links.
 */
const schema = {
  ...defaultSchema,
  tagNames: ["p", "br", "strong", "em", "del", "code", "pre", "blockquote", "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "hr", "table", "thead", "tbody", "tr", "th", "td"],
  attributes: {
    a: ["href"],
    code: ["className"],
    th: ["align"],
    td: ["align"],
  },
  protocols: { href: ["http", "https", "mailto"] },
  strip: ["script", "style", "img", "iframe", "object", "embed"],
  clobber: [],
};

const processor = unified().use(remarkParse).use(remarkRehype).use(rehypeSanitize, schema).use(rehypeStringify);

export async function renderMarkdown(source: string): Promise<string> {
  const file = await processor.process(source);
  return String(file).replace(/<a href=/g, '<a rel="noopener noreferrer nofollow" target="_blank" href=');
}
