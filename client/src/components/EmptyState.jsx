import { SearchX } from 'lucide-react';

export default function EmptyState({ icon: Icon = SearchX, title, text, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sand-100 text-ink-muted">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-display text-xl font-semibold text-ink">{title}</h3>
      {text && <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
