/**
 * YouTube playlist helpers shared by the admin editor and the public course
 * player. A playlist id is stored separately from the resource's source URL so
 * the site can render an embedded player without scraping YouTube.
 */

export const YOUTUBE_PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,64}$/;
export const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com'
]);

/** Extract a playlist id from a URL, an embed URL, or a raw id. */
export function parseYouTubePlaylistId(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  // A raw playlist id is the simplest case.
  if (YOUTUBE_PLAYLIST_ID_RE.test(input)) return input;

  try {
    const url = new URL(input);
    if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return '';
    const list = url.searchParams.get('list') || '';
    return YOUTUBE_PLAYLIST_ID_RE.test(list) ? list : '';
  } catch {
    return '';
  }
}

/** Canonical public playlist URL used for the "open on YouTube" link. */
export function youtubePlaylistUrl(playlistId) {
  const id = parseYouTubePlaylistId(playlistId);
  return id ? `https://www.youtube.com/playlist?list=${encodeURIComponent(id)}` : '';
}

/** Accepts a raw id, watch URL, youtu.be URL, embed URL or Shorts URL. */
export function parseYouTubeVideoId(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (YOUTUBE_VIDEO_ID_RE.test(input)) return input;

  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return '';

    if (host === 'youtu.be') {
      const candidate = url.pathname.split('/').filter(Boolean)[0] || '';
      return YOUTUBE_VIDEO_ID_RE.test(candidate) ? candidate : '';
    }

    const queryId = url.searchParams.get('v') || '';
    if (YOUTUBE_VIDEO_ID_RE.test(queryId)) return queryId;

    const parts = url.pathname.split('/').filter(Boolean);
    if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
      const candidate = parts[1] || '';
      return YOUTUBE_VIDEO_ID_RE.test(candidate) ? candidate : '';
    }
  } catch {
    return '';
  }
  return '';
}

export function youtubeVideoUrl(videoId) {
  const id = parseYouTubeVideoId(videoId);
  return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : '';
}

/** Privacy-enhanced embed for one video. */
export function youtubeVideoEmbedUrl(videoId) {
  const id = parseYouTubeVideoId(videoId);
  return id
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1`
    : '';
}

/**
 * Privacy-enhanced playlist embed used as a fallback for courses imported
 * before the per-video lesson list existed.
 */
export function youtubeEmbedUrl(playlistId) {
  const id = parseYouTubePlaylistId(playlistId);
  return id
    ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(id)}&rel=0`
    : '';
}
