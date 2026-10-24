import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { isPublicSitePath } from '../lib/publicSiteRoutes';

const TOKEN_RE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|`[^`]+`)/g;

function safeHref(value) {
  if (isPublicSitePath(value)) return 'internal';
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? 'external' : null;
  } catch {
    return null;
  }
}

/**
 * Small, dependency-free renderer for the handful of Markdown markers Groq
 * models commonly emit (**bold**, *italic*, `code`, and [links](url)).
 *
 * It intentionally does not use dangerouslySetInnerHTML: the model output is
 * untrusted text, and internal links are restricted to public routes.
 */
export default function RichText({ text }) {
  const source = String(text || '');
  const parts = source.split(TOKEN_RE);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={index} className="rounded bg-sand-100 px-1 py-0.5 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    const linkType = link ? safeHref(link[2]) : null;
    if (link && linkType === 'internal') {
      return (
        <Link
          key={index}
          to={link[2]}
          className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900"
        >
          {link[1]}
        </Link>
      );
    }
    if (link && linkType === 'external') {
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900"
        >
          {link[1]}
        </a>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}
