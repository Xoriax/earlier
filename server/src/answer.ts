const BRACKETS = /\s*[([{][^)\]}]*[)\]}]/g;
const FEATURING = /\s+(?:ft\.?|feat\.?|featuring)\s.*$/i;
const NOISE =
  /\b(?:official\s+(?:music\s+)?(?:video|audio|clip|lyric\s+video)|clip\s+officiel|lyrics?\s+video|audio\s+officiel)\b/gi;
const SEPARATOR = /\s+[-–—]\s+/;

/**
 * Extrait artiste et titre d'un titre de vidéo YouTube.
 * Gère les formats "Artiste - Titre (Official Video)" et les chaînes "Artiste - Topic".
 */
export function parseVideoTitle(rawTitle: string, channelTitle: string): { title: string; artist: string } {
  const cleaned = rawTitle.replace(BRACKETS, '').replace(NOISE, '').replace(/["“”]/g, '').trim();
  const channel = channelTitle.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();

  const match = SEPARATOR.exec(cleaned);
  let artist: string;
  let title: string;
  if (match) {
    artist = cleaned.slice(0, match.index);
    title = cleaned.slice(match.index + match[0].length);
  } else {
    artist = channel;
    title = cleaned;
  }

  title = title.split(/\s+\|\s+/)[0].replace(FEATURING, '').trim();
  artist = artist.replace(FEATURING, '').trim();
  return { title, artist };
}

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(?:the|le|la|les|l) /, '');
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[b.length];
}

function tolerance(length: number): number {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  return Math.floor(length * 0.2);
}

function matchesOne(guess: string, target: string): boolean {
  if (!guess || !target) return false;
  if (guess === target) return true;
  if (levenshtein(guess, target) <= tolerance(target.length)) return true;
  // Permet de donner "artiste titre" en une seule proposition, sans accepter un pavé de mots
  return target.length >= 3 && guess.length <= target.length + 40 && ` ${guess} `.includes(` ${target} `);
}

export function matchesTitle(guess: string, title: string): boolean {
  return matchesOne(normalize(guess), normalize(title));
}

/** Accepte l'artiste complet ou un seul des artistes d'une collaboration. */
export function matchesArtist(guess: string, artist: string): boolean {
  const g = normalize(guess);
  const parts = artist.split(/\s*(?:&|,|\bx\b|\bet\b|\band\b|\bvs\.?)\s*/i);
  return [artist, ...parts].some((part) => matchesOne(g, normalize(part)));
}
