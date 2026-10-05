import type { ThemeId } from '@earlier/shared';
import { normalize } from './answer';
import { fetchPlaylistTracks, searchPlaylists, type Track } from './youtube';

const year = new Date().getFullYear();

const THEME_QUERIES: Record<Exclude<ThemeId, 'all'>, string[]> = {
  '80s': ['hits années 80', '80s greatest hits'],
  '90s': ['hits années 90', '90s hits playlist'],
  '2000s': ['hits années 2000', '2000s hits playlist'],
  '2010s': ['hits années 2010', '2010s hits playlist'],
  current: [`top hits ${year}`, `hits ${year} france`],
  'rap-fr': ['rap français classiques', 'rap fr hits'],
  'chanson-fr': ['chanson française incontournables', 'variété française hits'],
  rock: ['rock classics playlist', 'best rock songs of all time'],
};

/** Nombre de playlists piochées par partie : plus il y en a, plus c'est varié */
const PLAYLISTS_PER_GAME = 3;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Tire des morceaux au hasard dans plusieurs playlists trouvées par recherche sur le thème.
 * Les morceaux déjà joués (excludeIds) et les doublons sont écartés.
 */
export async function randomTracks(theme: ThemeId, count: number, excludeIds: Set<string>): Promise<Track[]> {
  const queries = theme === 'all' ? Object.values(THEME_QUERIES).flat() : THEME_QUERIES[theme];

  const playlistIds = new Set<string>();
  for (let i = 0; i < PLAYLISTS_PER_GAME; i++) {
    const found = await searchPlaylists(pick(queries));
    const fresh = found.filter((id) => !playlistIds.has(id));
    if (fresh.length) playlistIds.add(pick(fresh));
  }

  const pool: Track[] = [];
  const seen = new Set<string>();
  for (const playlistId of playlistIds) {
    for (const track of await fetchPlaylistTracks(playlistId)) {
      const key = normalize(`${track.artist} ${track.title}`);
      if (excludeIds.has(track.videoId) || seen.has(key)) continue;
      seen.add(key);
      pool.push(track);
    }
  }

  return shuffle(pool).slice(0, count);
}
