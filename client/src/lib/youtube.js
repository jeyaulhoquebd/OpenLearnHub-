/**
 * YouTube playlist helpers shared by the admin editor and the public course
 * player. A playlist id is stored separately from the resource's source URL so
 * the site can render an embedded player without scraping YouTube.
 */

export const YOUTUBE_PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,64}$/;

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

/**
 * Privacy-enhanced embed URL. `videoseries` plays the whole playlist and lets
 * the learner move between videos without leaving OpenLearn Hub.
 */
export function youtubeEmbedUrl(playlistId) {
  const id = parseYouTubePlaylistId(playlistId);
  return id
    ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(id)}&rel=0`
    : '';
}
