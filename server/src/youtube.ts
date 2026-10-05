import { config } from './config';
import { parseVideoTitle } from './answer';

const API_URL = 'https://www.googleapis.com/youtube/v3';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_TRACKS = 200;
const MIN_DURATION_SEC = 60;
// Au-delà, c'est généralement une compilation ou un mix
const MAX_DURATION_SEC = 10 * 60;

export interface Track {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  durationSec: number;
}

const cache = new Map<string, { tracks: Track[]; fetchedAt: number }>();

export function parsePlaylistId(input: string): string | null {
  const value = input.trim();
  try {
    return new URL(value).searchParams.get('list');
  } catch {
    return /^[\w-]{10,}$/.test(value) ? value : null;
  }
}

async function apiGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('key', config.youtubeApiKey);

  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `Erreur YouTube (${res.status})`);
  }
  return body as T;
}

interface PlaylistItemsResponse {
  nextPageToken?: string;
  items: {
    snippet: {
      title: string;
      videoOwnerChannelTitle?: string;
      resourceId: { videoId: string };
      thumbnails?: Record<string, { url: string }>;
    };
  }[];
}

interface VideosResponse {
  items: {
    id: string;
    status: { embeddable: boolean; privacyStatus: string };
    contentDetails: { duration: string };
  }[];
}

function parseIsoDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/**
 * Récupère les morceaux d'une playlist (1 unité de quota par page de 50)
 * puis filtre ceux qui sont intégrables (1 unité par lot de 50).
 */
export async function fetchPlaylistTracks(playlistId: string): Promise<Track[]> {
  const cached = cache.get(playlistId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.tracks;

  const candidates: Omit<Track, 'durationSec'>[] = [];
  let pageToken: string | undefined;
  do {
    const page = await apiGet<PlaylistItemsResponse>('playlistItems', {
      part: 'snippet',
      playlistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    for (const { snippet } of page.items) {
      const videoId = snippet.resourceId.videoId;
      if (!videoId || !snippet.videoOwnerChannelTitle) continue; // vidéo privée ou supprimée
      const { title, artist } = parseVideoTitle(snippet.title, snippet.videoOwnerChannelTitle);
      if (!title || !artist) continue;
      const thumbs = snippet.thumbnails ?? {};
      const thumbnail = (thumbs.high ?? thumbs.medium ?? thumbs.default)?.url ?? '';
      candidates.push({ videoId, title, artist, thumbnail });
    }
    pageToken = page.nextPageToken;
  } while (pageToken && candidates.length < MAX_TRACKS);

  const tracks: Track[] = [];
  for (let i = 0; i < candidates.length; i += 50) {
    const batch = candidates.slice(i, i + 50);
    const videos = await apiGet<VideosResponse>('videos', {
      part: 'status,contentDetails',
      id: batch.map((c) => c.videoId).join(','),
    });
    const details = new Map(videos.items.map((v) => [v.id, v]));
    for (const candidate of batch) {
      const video = details.get(candidate.videoId);
      if (!video?.status.embeddable || video.status.privacyStatus === 'private') continue;
      const durationSec = parseIsoDuration(video.contentDetails.duration);
      if (durationSec < MIN_DURATION_SEC || durationSec > MAX_DURATION_SEC) continue;
      tracks.push({ ...candidate, durationSec });
    }
  }

  cache.set(playlistId, { tracks, fetchedAt: Date.now() });
  return tracks;
}

interface SearchResponse {
  items: { id: { playlistId?: string } }[];
}

const searchCache = new Map<string, { playlistIds: string[]; fetchedAt: number }>();
const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Recherche des playlists (100 unités de quota par appel, d'où le cache de 24 h) */
export async function searchPlaylists(query: string): Promise<string[]> {
  const cached = searchCache.get(query);
  if (cached && Date.now() - cached.fetchedAt < SEARCH_CACHE_TTL_MS) return cached.playlistIds;

  const res = await apiGet<SearchResponse>('search', {
    part: 'snippet',
    type: 'playlist',
    q: query,
    maxResults: '25',
  });
  const playlistIds = res.items.map((item) => item.id.playlistId).filter((id): id is string => !!id);
  searchCache.set(query, { playlistIds, fetchedAt: Date.now() });
  return playlistIds;
}
