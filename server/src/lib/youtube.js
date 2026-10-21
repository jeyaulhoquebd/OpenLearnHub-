/**
 * Server-side YouTube playlist validation.
 *
 * We deliberately do not call the YouTube Data API: an admin supplies the
 * public playlist URL, and the public site embeds YouTube's own playlist
 * player. This keeps the feature usable without another API key while still
 * validating that the stored id cannot be used to inject an arbitrary URL.
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

export function parseYouTubePlaylistId(value) {
  const input = String(value || '').trim();
  if (!input) return '';

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

export function youtubePlaylistUrl(playlistId) {
  const id = parseYouTubePlaylistId(playlistId);
  return id ? `https://www.youtube.com/playlist?list=${encodeURIComponent(id)}` : '';
}
