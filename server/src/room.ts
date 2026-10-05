import type {
  GuessResult,
  PlayerInfo,
  RoomSettings,
  RoomState,
  RoomStatus,
  RoundPhase,
  RoundPrepare,
  RoundStart,
} from '@earlier/shared';
import { LIMITS, THEMES } from '@earlier/shared';
import type { IO } from './types';
import { fetchPlaylistTracks, parsePlaylistId, type Track } from './youtube';
import { matchesArtist, matchesTitle } from './answer';
import { randomTracks, shuffle } from './random';

/** Durée minimale du décompte affiché, chargement compris */
const COUNTDOWN_MS = 3000;
/** Marge entre « tout le monde est prêt » et le top départ */
const MIN_GO_DELAY_MS = 1000;
/** Au-delà, on lance la manche sans attendre les retardataires */
const LOADING_TIMEOUT_MS = 8000;
/** Plus long pour la 1re manche, où les lecteurs YouTube s'initialisent parfois encore */
const FIRST_LOADING_TIMEOUT_MS = 15000;
const REVEAL_MS = 6000;

interface Player {
  id: string;
  name: string;
  score: number;
  foundTitle: boolean;
  foundArtist: boolean;
}

function clamp(value: number, { min, max }: { min: number; max: number }): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export class Room {
  status: RoomStatus = 'lobby';
  phase: RoundPhase = 'idle';
  hostId: string;
  settings: RoomSettings = {
    source: 'random',
    playlistUrl: '',
    theme: 'all',
    rounds: LIMITS.rounds.default,
    roundDuration: LIMITS.roundDuration.default,
  };

  private players = new Map<string, Player>();
  private tracks: Track[] = [];
  private round = 0;
  private currentPrepare: RoundPrepare | null = null;
  private currentRound: RoundStart | null = null;
  private loadingSince = 0;
  private readyIds = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private starting = false;
  /** Morceaux déjà joués dans ce salon, pour ne pas les resservir en cas de revanche */
  private playedIds = new Set<string>();

  constructor(
    readonly code: string,
    private readonly io: IO,
    hostId: string,
  ) {
    this.hostId = hostId;
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  hasName(name: string): boolean {
    const lower = name.toLowerCase();
    return [...this.players.values()].some((p) => p.name.toLowerCase() === lower);
  }

  addPlayer(id: string, name: string): void {
    this.players.set(id, { id, name, score: 0, foundTitle: false, foundArtist: false });
    this.broadcast();
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    if (this.isEmpty) {
      this.dispose();
      return;
    }
    if (this.hostId === id) this.hostId = this.players.keys().next().value!;
    this.broadcast();
    if (this.phase === 'loading' && this.everyoneReady()) this.go();
    if (this.phase === 'playing' && this.everyoneFoundAll()) this.endRound();
  }

  /** Manche en cours, pour qu'un joueur arrivant en cours de partie puisse la rejoindre */
  get activeRound(): { prepare: RoundPrepare } | { start: RoundStart } | null {
    if (this.phase === 'loading' && this.currentPrepare) return { prepare: this.currentPrepare };
    if (this.phase === 'playing' && this.currentRound) return { start: this.currentRound };
    return null;
  }

  markReady(playerId: string, round: number): void {
    if (this.phase !== 'loading' || round !== this.round || !this.players.has(playerId)) return;
    this.readyIds.add(playerId);
    if (this.everyoneReady()) this.go();
  }

  state(): RoomState {
    const players: PlayerInfo[] = [...this.players.values()].map((p) => ({
      ...p,
      isHost: p.id === this.hostId,
    }));
    return {
      code: this.code,
      status: this.status,
      phase: this.phase,
      settings: this.settings,
      players,
      round: this.round,
      totalRounds: this.tracks.length,
    };
  }

  updateSettings(playerId: string, patch: Partial<RoomSettings>): void {
    if (playerId !== this.hostId || this.status === 'playing') return;
    const next = { ...this.settings };
    if (patch.source === 'playlist' || patch.source === 'random') next.source = patch.source;
    if (typeof patch.playlistUrl === 'string') next.playlistUrl = patch.playlistUrl.slice(0, 300);
    if (THEMES.some((t) => t.id === patch.theme)) next.theme = patch.theme!;
    if (typeof patch.rounds === 'number') next.rounds = clamp(patch.rounds, LIMITS.rounds);
    if (typeof patch.roundDuration === 'number') {
      next.roundDuration = clamp(patch.roundDuration, LIMITS.roundDuration);
    }
    this.settings = next;
    this.broadcast();
  }

  async start(playerId: string): Promise<void> {
    if (playerId !== this.hostId) throw new Error("Seul l'hôte peut lancer la partie.");
    if (this.status === 'playing' || this.starting) throw new Error('La partie est déjà lancée.');

    this.starting = true;
    try {
      this.tracks = await this.loadTracks();
    } finally {
      this.starting = false;
    }
    for (const track of this.tracks) this.playedIds.add(track.videoId);

    for (const p of this.players.values()) p.score = 0;
    this.status = 'playing';
    this.round = 0;
    this.nextRound();
  }

  guess(playerId: string, text: string): GuessResult {
    const result: GuessResult = { title: false, artist: false, points: 0 };
    const player = this.players.get(playerId);
    const round = this.currentRound;
    const now = Date.now();
    if (!player || !round || this.phase !== 'playing' || now < round.startAt || now > round.endsAt) {
      return result;
    }

    const track = this.tracks[this.round - 1];
    if (!player.foundTitle && matchesTitle(text, track.title)) {
      player.foundTitle = result.title = true;
      result.points++;
    }
    if (!player.foundArtist && matchesArtist(text, track.artist)) {
      player.foundArtist = result.artist = true;
      result.points++;
    }

    if (result.points > 0) {
      player.score += result.points;
      this.broadcast();
      if (this.everyoneFoundAll()) this.endRound();
    }
    return result;
  }

  private async loadTracks(): Promise<Track[]> {
    const { source, playlistUrl, theme, rounds } = this.settings;

    if (source === 'random') {
      const tracks = await randomTracks(theme, rounds, this.playedIds);
      if (tracks.length === 0) throw new Error('Aucun morceau trouvé pour ce thème, réessaie.');
      return tracks;
    }

    const playlistId = parsePlaylistId(playlistUrl);
    if (!playlistId) throw new Error('Lien de playlist YouTube invalide.');
    const tracks = await fetchPlaylistTracks(playlistId);
    if (tracks.length === 0) throw new Error('Aucun morceau jouable dans cette playlist.');

    // On évite les morceaux déjà joués tant qu'il en reste assez
    const unplayed = tracks.filter((t) => !this.playedIds.has(t.videoId));
    const pool = unplayed.length >= rounds ? unplayed : tracks;
    return shuffle(pool).slice(0, rounds);
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private everyoneReady(): boolean {
    return [...this.players.keys()].every((id) => this.readyIds.has(id));
  }

  private everyoneFoundAll(): boolean {
    return [...this.players.values()].every((p) => p.foundTitle && p.foundArtist);
  }

  private nextRound(): void {
    if (this.round >= this.tracks.length) {
      this.endGame();
      return;
    }

    const track = this.tracks[this.round];
    this.round++;
    for (const p of this.players.values()) p.foundTitle = p.foundArtist = false;

    // On démarre entre 20 % et 50 % du morceau, en gardant de la marge pour la durée d'écoute
    const durationSec = this.settings.roundDuration;
    const maxStart = Math.max(0, track.durationSec - durationSec - 5);
    const startSeconds = Math.floor(Math.min(maxStart, track.durationSec * (0.2 + Math.random() * 0.3)));

    this.currentPrepare = {
      round: this.round,
      totalRounds: this.tracks.length,
      videoId: track.videoId,
      startSeconds,
    };
    this.currentRound = null;
    this.readyIds.clear();
    this.loadingSince = Date.now();
    this.phase = 'loading';
    this.broadcast();
    this.io.to(this.code).emit('round:prepare', this.currentPrepare);
    this.schedule(() => this.go(), this.round === 1 ? FIRST_LOADING_TIMEOUT_MS : LOADING_TIMEOUT_MS);
  }

  /** Tout le monde a chargé la vidéo (ou le délai est dépassé) : on fixe le top départ */
  private go(): void {
    if (this.phase !== 'loading' || !this.currentPrepare) return;
    const now = Date.now();
    const startAt = Math.max(now + MIN_GO_DELAY_MS, this.loadingSince + COUNTDOWN_MS);
    this.currentRound = {
      ...this.currentPrepare,
      startAt,
      endsAt: startAt + this.settings.roundDuration * 1000,
    };
    this.phase = 'playing';
    this.broadcast();
    this.io.to(this.code).emit('round:start', this.currentRound);
    this.schedule(() => this.endRound(), this.currentRound.endsAt - now);
  }

  private endRound(): void {
    if (this.phase !== 'playing') return;
    const { videoId, title, artist, thumbnail } = this.tracks[this.round - 1];
    this.phase = 'reveal';
    this.broadcast();
    this.io.to(this.code).emit('round:end', { track: { videoId, title, artist, thumbnail } });
    this.schedule(() => this.nextRound(), REVEAL_MS);
  }

  private endGame(): void {
    this.status = 'ended';
    this.phase = 'idle';
    this.currentPrepare = null;
    this.currentRound = null;
    this.broadcast();
  }

  private schedule(fn: () => void, delayMs: number): void {
    this.dispose();
    this.timer = setTimeout(fn, Math.max(0, delayMs));
  }

  private broadcast(): void {
    this.io.to(this.code).emit('room:state', this.state());
  }
}
