import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, PlayCircle, ShieldCheck, Youtube } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localized } from '../lib/utils';
import {
  parseYouTubeVideoId,
  youtubeEmbedUrl,
  youtubePlaylistUrl,
  youtubeVideoEmbedUrl,
  youtubeVideoUrl
} from '../lib/youtube';

/**
 * Focused YouTube course player.
 *
 * When the admin has imported the playlist, every lesson is a separate video
 * and the learner sees only that course's player and lesson list. Courses
 * created before the importer existed fall back to YouTube's playlist embed.
 *
 * Playback uses YouTube's official IFrame Player API. The YouTube Data API key
 * stays on the Express server and is never part of this component.
 */

const API_SRC = 'https://www.youtube.com/iframe_api';
let apiPromise = null;

function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no_window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('youtube_api_timeout'));
    }, 12000);

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        if (typeof previous === 'function') previous();
      } finally {
        window.clearTimeout(timeout);
        resolve(window.YT);
      }
    };

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = API_SRC;
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('youtube_api_failed'));
      };
      document.head.appendChild(script);
    }
  }).catch((error) => {
    apiPromise = null;
    throw error;
  });

  return apiPromise;
}

function YouTubeLessonPlayer({ video, onEnded, title }) {
  const mountRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const endedRef = useRef(onEnded);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  endedRef.current = onEnded;

  useEffect(() => {
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return undefined;

    const playerHost = document.createElement('div');
    playerHost.className = 'h-full w-full';
    mount.innerHTML = '';
    mount.appendChild(playerHost);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !playerHost.isConnected) return;
        playerRef.current = new YT.Player(playerHost, {
          videoId: video.videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin
          },
          events: {
            onReady: () => {
              readyRef.current = true;
              if (!cancelled) setLoading(false);
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.ENDED) endedRef.current?.();
            }
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      readyRef.current = false;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* player may already be gone */
      }
      playerRef.current = null;
      if (mount) mount.innerHTML = '';
    };
    // The player is created once; changing lessons uses loadVideoById below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current || !video.videoId) return;
    try {
      const currentId = player.getVideoData?.()?.video_id;
      if (currentId !== video.videoId) {
        player.loadVideoById({ videoId: video.videoId });
      }
    } catch {
      /* the iframe may still be initialising */
    }
  }, [video.videoId]);

  if (failed || !parseYouTubeVideoId(video.videoId)) {
    return (
      <div className="relative h-full w-full bg-black">
        {parseYouTubeVideoId(video.videoId) ? (
          <iframe
            src={youtubeVideoEmbedUrl(video.videoId)}
            title={title}
            className="h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center text-sm text-white/70">
            This lesson cannot be played here.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <div ref={mountRef} className="h-full w-full" />
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
          <Loader2 className="h-7 w-7 animate-spin text-white" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

export default function CoursePlayer({
  resource,
  videos = [],
  currentIndex = 0,
  onVideoEnded,
  className = '',
  showHeader = true
}) {
  const { t, i18n } = useTranslation();
  const playlistId = resource?.youtubePlaylistId || '';
  const lesson = videos[currentIndex] || null;
  const title = localized(resource?.title, i18n.language) || t('youtubeCourse.playerTitle');

  if (!lesson) {
    const embedUrl = youtubeEmbedUrl(playlistId);
    if (!embedUrl) return null;
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
                <p className="mt-1 text-[11px] font-medium text-white/70">
                  {t('youtubeCourse.playlistLabel')}
                </p>
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
            {t('youtubeCourse.playlistFallbackHint')}
          </p>
        </div>
      </section>
    );
  }

  const externalUrl = lesson.sourceUrl || youtubeVideoUrl(lesson.videoId) || resource?.sourceUrl;
  const canEmbed = lesson.embeddable !== false && lesson.available !== false;

  return (
    <section className={`overflow-hidden rounded-3xl border border-sand-200 bg-surface shadow-soft ${className}`}>
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 bg-gradient-to-r from-navy-950 to-navy-800 px-4 py-3 text-white sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-inset ring-white/25">
              <Youtube className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-none">{lesson.title || title}</p>
              <p className="mt-1 text-[11px] font-medium text-white/70">
                {t('youtubeCourse.lessonCounter', {
                  current: currentIndex + 1,
                  total: videos.length
                })}
                {lesson.durationText ? ` · ${lesson.durationText}` : ''}
              </p>
            </div>
          </div>
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/15"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              {t('youtubeCourse.watchOnYouTube')}
            </a>
          )}
        </div>
      )}

      <div className="aspect-video w-full bg-black">
        {canEmbed ? (
          <YouTubeLessonPlayer
            key={lesson.id || lesson.videoId}
            video={lesson}
            onEnded={onVideoEnded}
            title={`${t('youtubeCourse.playerTitle')} — ${lesson.title || title}`}
          />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <p className="text-sm font-semibold text-white">{t('youtubeCourse.lessonUnavailable')}</p>
              {externalUrl && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('youtubeCourse.openLessonOnYouTube')}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
          {t('youtubeCourse.playerNote')}
        </p>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
          <PlayCircle className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
          {t('youtubeCourse.playerHint')}
        </p>
      </div>
    </section>
  );
}
