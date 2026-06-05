import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";

/**
 * MarkdownRenderer — renders markdown content with:
 *  - GitHub-Flavored Markdown (tables, strikethrough, task lists)
 *  - Syntax highlighted code blocks
 *  - Safe link handling (external links open in new tab)
 *  - @mention and #hashtag auto-linking
 *  - Optional "preview" mode that truncates after `previewLines` lines
 */
export default function MarkdownRenderer({ content = "", preview = false, previewLines = 3 }) {
  if (!content) return null;

  // In preview mode, take the first `previewLines` lines and strip markdown syntax
  // to produce a clean plain-text excerpt
  let rendered = content;
  if (preview) {
    const lines = content.split("\n").filter((l) => l.trim() !== "");
    rendered = lines.slice(0, previewLines).join("\n");
  }

  return (
    <div className={`md-body${preview ? " md-preview" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Safe links — external open in new tab, internal use React Router
          a({ href, children, ...props }) {
            if (!href) return <span>{children}</span>;
            const isExternal = href.startsWith("http") || href.startsWith("//");
            if (isExternal) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              );
            }
            return <Link to={href}>{children}</Link>;
          },
          // Prevent <img> from breaking layout in post previews
          img({ src, alt }) {
            if (preview) return null;
            return <img src={src} alt={alt || ""} className="md-image" />;
          },
          // Code blocks
          pre({ children }) {
            return <pre className="md-pre">{children}</pre>;
          },
          code({ inline, className, children, ...props }) {
            if (inline) {
              return <code className="md-inline-code" {...props}>{children}</code>;
            }
            return <code className={className} {...props}>{children}</code>;
          },
          // Blockquotes
          blockquote({ children }) {
            return <blockquote className="md-blockquote">{children}</blockquote>;
          },
          // Tables
          table({ children }) {
            return (
              <div className="md-table-wrap">
                <table className="md-table">{children}</table>
              </div>
            );
          },
          // Headings — downgrade h1→h2 so post titles stay as h1
          h1({ children }) {
            return <h2 className="md-heading">{children}</h2>;
          },
          h2({ children }) {
            return <h3 className="md-heading">{children}</h3>;
          },
          h3({ children }) {
            return <h4 className="md-heading">{children}</h4>;
          },
          // Paragraphs — process @mentions and #hashtags inline
          p({ children }) {
            return <p className="md-p">{processInlineTokens(children)}</p>;
          },
        }}
      >
        {rendered}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Walk React children and convert @mention / #hashtag text patterns
 * into clickable links without double-rendering markdown.
 */
function processInlineTokens(children) {
  if (!children) return children;

  const processText = (text) => {
    if (typeof text !== "string") return text;
    // Split by @username or #hashtag patterns
    const parts = text.split(/([@#][a-zA-Z0-9_]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const username = part.slice(1);
        return (
          <Link key={i} to={`/search?q=${encodeURIComponent(username)}`} className="md-mention">
            {part}
          </Link>
        );
      }
      if (part.startsWith("#")) {
        const tag = part.slice(1);
        return (
          <Link key={i} to={`/hashtag/${tag}`} className="md-hashtag">
            {part}
          </Link>
        );
      }
      return part;
    });
  };

  if (typeof children === "string") return processText(children);
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        const processed = processText(child);
        // If processText returned an array (found tokens), key each element
        return Array.isArray(processed)
          ? processed.map((el, j) => (typeof el === "string" ? el : { ...el, key: `${i}-${j}` }))
          : processed;
      }
      return child;
    });
  }
  return children;
}
