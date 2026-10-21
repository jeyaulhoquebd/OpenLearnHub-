import { ExternalLink, PlayCircle, ShieldCheck, Youtube } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localized } from '../lib/utils';
import { youtubeEmbedUrl, youtubePlaylistUrl } from '../lib/youtube';

/**
 * Embedded YouTube playlist player used on course detail pages and the
 * focused `/course/:id` route. Playback stays on OpenLearn Hub; the external
 * link is only an escape hatch for learners who prefer YouTube itself.
 */
export default function CoursePlayer({ resource, className = '', showHeader = true }) {
  const { t, i18n } = useTranslation();
  const playlistId = resource?.youtubePlaylistId || '';
  const embedUrl = youtubeEmbedUrl(playlistId);
  if (!embedUrl) return null;

  const title = localized(resource?.title, i18n.language) || t('youtubeCourse.playerTitle');
  const externalUrl = resource?.sourceUrl || youtubePlaylistUrl(playlistId);

  return (
    <section className={`overflow-hidden rounded-3xl border border-sand-200 bg-surface shadow-soft ${className}`}>
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 bg-gradient-to-r from-navy-950 to-navy-800 px-4 py-3 text-white sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/15 ring-1 ring-inset ring-white/25">
              <Youtube className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold leading-none">{t('youtubeCourse.playerTitle')}</p>
              <p className="mt-1 text-[11px] font-medium text-white/70">{t('youtubeCourse.playlistLabel')}</p>
            </div>
          </div>
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/15"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            {t('youtubeCourse.watchOnYouTube')}
          </a>
        </div>
      )}

      <div className="aspect-video w-full bg-black">
        <iframe
          src={embedUrl}
          title={`${t('youtubeCourse.playerTitle')} — ${title}`}
          className="h-full w-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
          {t('youtubeCourse.playerNote')}
        </p>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
          <PlayCircle className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
          {t('youtubeCourse.coursePlayerHint')}
        </p>
      </div>
    </section>
  );
}
