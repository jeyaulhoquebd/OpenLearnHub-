import { useEffect } from 'react';

const DEFAULT_TITLE = 'OpenLearn Hub — Knowledge for Everyone';

export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} · OpenLearn Hub` : DEFAULT_TITLE;

    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description]);
}
