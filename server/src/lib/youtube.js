import { config } from '../config.js';

/**
 * Server-side YouTube helpers.
 *
 * The API key is read only on the server and is never included in a client
 * response. Playback still happens in YouTube's official IFrame player, so we
 * never download, re-upload or proxy video bytes.
 */

export const YOUTUBE_PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,64}$/;
export const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
export const YOUTUBE_PLAYLIST_ITEM_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com'
]);

const API_ROOT = 'https://www.googleapis.com/youtube/v3';
const MAX_PLAYLIST_ITEMS = 5000;

function fail(code, message, status = 0) {
  const error = new Error(message || code);
  error.code = code;
  error.status = status;
  return error;
}

export function isYouTubeConfigured() {
  return Boolean(config.youtube.apiKey);
}

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

export function youtubeEmbedUrl(videoId) {
  const id = parseYouTubeVideoId(videoId);
  return id
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`
    : '';
}

/** ISO-8601 duration (`PT1H2M3S`) → seconds. */
export function parseIsoDuration(value) {
  const match = String(value || '').match(
    /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i
  );
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match;
  return (
    (Number(days) || 0) * 86400 +
    (Number(hours) || 0) * 3600 +
    (Number(minutes) || 0) * 60 +
    (Number(seconds) || 0)
  );
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function text(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function blockText(value, max) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);
}

function thumbnailOf(snippet = {}, fallback = '') {
  const thumbnails = snippet.thumbnails || {};
  const preferred = ['maxres', 'standard', 'high', 'medium', 'default'];
  for (const key of preferred) {
    const url = thumbnails[key]?.url;
    if (url) return String(url).replace(/^http:/, 'https:').slice(0, 800);
  }
  return fallback;
}

function chunk(list, size) {
  const output = [];
  for (let index = 0; index < list.length; index += size) {
    output.push(list.slice(index, index + size));
  }
  return output;
}

async function youtubeGet(resource, params = {}) {
  if (!config.youtube.apiKey) {
    throw fail(
      'youtube_not_configured',
      'YouTube is not configured. Add YOUTUBE_API_KEY to server/.env and restart the API.',
      503
    );
  }

  const url = new URL(`${API_ROOT}/${resource}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set('key', config.youtube.apiKey);

  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(config.youtube.timeoutMs)
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw fail('youtube_timeout', 'YouTube did not respond in time. Please try again.', 504);
    }
    throw fail(
      'youtube_unreachable',
      'The YouTube API could not be reached. Check the server connection and try again.',
      502
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const reason = payload?.error?.errors?.[0]?.reason || payload?.error?.status || '';
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw fail(
        'youtube_quota_exceeded',
        'The YouTube API quota has been reached. Try again later or use a different API key.',
        429
      );
    }
    if (reason === 'keyInvalid' || reason === 'badRequest' && /API key/i.test(payload?.error?.message || '')) {
      throw fail(
        'youtube_key_invalid',
        'YouTube rejected the server API key. Check YOUTUBE_API_KEY in server/.env.',
        502
      );
    }
    if (response.status === 404 || reason === 'playlistNotFound') {
      throw fail(
        'youtube_playlist_not_found',
        'That playlist could not be found. Make sure it is public and the link is correct.',
        404
      );
    }
    if (response.status === 403) {
      throw fail(
        'youtube_forbidden',
        'YouTube refused access to this playlist. It may be private, unlisted with restricted access, or unavailable in this region.',
        403
      );
    }
    if (response.status === 400) {
      throw fail(
        'youtube_invalid_request',
        'YouTube rejected that playlist request. Check the playlist link and try again.',
        400
      );
    }
    throw fail('youtube_api_error', 'YouTube could not load that playlist right now.', 502);
  }

  return payload || {};
}

/**
 * Fetches a public playlist plus every video in it. Metadata is stored in
 * Firestore by the admin API; video bytes stay on YouTube.
 */
export async function fetchPlaylistCourse(value) {
  const playlistId = parseYouTubePlaylistId(value);
  if (!playlistId) {
    throw fail(
      'youtube_invalid_playlist',
      'Enter a valid public YouTube playlist URL or playlist ID.',
      400
    );
  }

  const details = await youtubeGet('playlists', {
    part: 'snippet,contentDetails,status',
    id: playlistId,
    maxResults: 1
  });
  const playlist = details.items?.[0];
  if (!playlist) {
    throw fail(
      'youtube_playlist_not_found',
      'That playlist could not be found. Make sure it is public and the link is correct.',
      404
    );
  }

  const itemRows = [];
  let pageToken = '';
  let truncated = false;
  const maxItems = Math.max(
    1,
    Math.min(Number(config.youtube.maxPlaylistItems) || MAX_PLAYLIST_ITEMS, MAX_PLAYLIST_ITEMS)
  );

  do {
    // eslint-disable-next-line no-await-in-loop
    const page = await youtubeGet('playlistItems', {
      part: 'snippet,contentDetails,status',
      playlistId,
      maxResults: 50,
      pageToken
    });
    const rows = Array.isArray(page.items) ? page.items : [];
    itemRows.push(...rows);
    pageToken = page.nextPageToken || '';
    if (itemRows.length >= maxItems) {
      truncated = Boolean(pageToken) || itemRows.length > maxItems;
      itemRows.length = Math.min(itemRows.length, maxItems);
      break;
    }
  } while (pageToken);

  const videoIds = Array.from(
    new Set(
      itemRows
        .map((item) => item.contentDetails?.videoId || '')
        .filter((id) => YOUTUBE_VIDEO_ID_RE.test(id))
    )
  );

  const videoById = new Map();
  for (const group of chunk(videoIds, 50)) {
    // eslint-disable-next-line no-await-in-loop
    const page = await youtubeGet('videos', {
      part: 'snippet,contentDetails,status',
      id: group.join(','),
      maxResults: 50
    });
    (page.items || []).forEach((video) => {
      if (YOUTUBE_VIDEO_ID_RE.test(video.id || '')) videoById.set(video.id, video);
    });
  }

  const videos = itemRows.map((item, index) => {
    const videoId = item.contentDetails?.videoId || '';
    const video = videoById.get(videoId) || null;
    const snippet = item.snippet || video?.snippet || {};
    const position = Number.isInteger(item.snippet?.position)
      ? item.snippet.position
      : index;
    const seconds = parseIsoDuration(video?.contentDetails?.duration);
    const fallbackThumb = videoId
      ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`
      : '';
    const itemId = YOUTUBE_PLAYLIST_ITEM_ID_RE.test(item.id || '')
      ? item.id
      : `${videoId || 'video'}-${position + 1}`;

    return {
      id: itemId,
      videoId,
      position,
      title: text(snippet.title, 300) || 'Untitled video',
      description: blockText(snippet.description, 2000),
      thumbnailUrl: thumbnailOf(snippet, fallbackThumb),
      durationSeconds: seconds,
      durationText: formatDuration(seconds),
      publishedAt: video?.snippet?.publishedAt || item.contentDetails?.videoPublishedAt || '',
      channelTitle: text(snippet.videoOwnerChannelTitle || video?.snippet?.channelTitle || snippet.channelTitle, 160),
      available: Boolean(video),
      embeddable: video?.status?.embeddable !== false,
      privacyStatus: text(video?.status?.privacyStatus, 20),
      sourceUrl: youtubeVideoUrl(videoId),
      embedUrl: youtubeEmbedUrl(videoId)
    };
  });

  const playlistSnippet = playlist.snippet || {};
  return {
    playlist: {
      id: playlistId,
      title: text(playlistSnippet.title, 300) || 'YouTube course',
      description: blockText(playlistSnippet.description, 2000),
      channelTitle: text(playlistSnippet.channelTitle, 160),
      channelId: text(playlistSnippet.channelId, 160),
      publishedAt: playlistSnippet.publishedAt || '',
      thumbnailUrl: thumbnailOf(playlistSnippet),
      sourceUrl: youtubePlaylistUrl(playlistId),
      videoCount: videos.length,
      reportedVideoCount: Number(playlist.contentDetails?.itemCount) || videos.length
    },
    videos,
    truncated,
    fetchedAt: new Date().toISOString()
  };
}
