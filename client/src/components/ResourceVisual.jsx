import { AppWindow, BookOpen, PlayCircle } from 'lucide-react';
import { monogram } from '../lib/utils';

const TYPE_GRADIENTS = {
  course: 'from-brand-900 via-brand-700 to-brand-500',
  book: 'from-amber-800 via-amber-600 to-orange-400',
  software: 'from-indigo-950 via-indigo-700 to-violet-500'
};

const ACCENT_GRADIENTS = {
  teal: 'from-brand-900 via-brand-700 to-brand-500',
  emerald: 'from-emerald-900 via-emerald-700 to-teal-400',
  lime: 'from-lime-800 via-lime-600 to-emerald-400',
  amber: 'from-amber-800 via-amber-600 to-orange-400',
  orange: 'from-orange-800 via-orange-600 to-amber-400',
  rose: 'from-rose-900 via-rose-700 to-pink-400',
  blue: 'from-blue-900 via-blue-700 to-sky-400',
  sky: 'from-sky-900 via-sky-700 to-cyan-400',
  indigo: 'from-indigo-950 via-indigo-700 to-blue-400',
  violet: 'from-violet-950 via-violet-700 to-fuchsia-400'
};

const TYPE_ICONS = {
  course: PlayCircle,
  book: BookOpen,
  software: AppWindow
};

export default function ResourceVisual({ resource, className = '', showIcon = true }) {
  const Icon = TYPE_ICONS[resource?.type] || BookOpen;
  const gradient =
    ACCENT_GRADIENTS[resource?.accent] || TYPE_GRADIENTS[resource?.type] || TYPE_GRADIENTS.course;

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} ${className}`}>
      <div className="absolute inset-0 bg-grid opacity-[0.18]" aria-hidden="true" />
      <div
        className="absolute -end-8 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-12 -start-6 h-36 w-36 rounded-full bg-black/10 blur-2xl"
        aria-hidden="true"
      />

      {resource?.thumbnailUrl ? (
        <>
          <img
            src={resource.thumbnailUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        </>
      ) : null}

      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          {showIcon && (
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-inset ring-white/25 backdrop-blur">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white ring-1 ring-inset ring-white/25 backdrop-blur">
            {resource?.level || ''}
          </span>
        </div>
        <div>
          <p className="font-display text-3xl font-semibold tracking-tight text-white/95">
            {monogram(resource?.provider || resource?.title)}
          </p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-white/80">{resource?.provider}</p>
        </div>
      </div>
    </div>
  );
}
