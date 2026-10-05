export type RoomStatus = 'lobby' | 'playing' | 'ended';
/** loading : chaque joueur charge la vidéo, le décompte démarre quand tout le monde est prêt */
export type RoundPhase = 'idle' | 'loading' | 'playing' | 'reveal';

export type MusicSource = 'playlist' | 'random';

export const THEMES = [
  { id: 'all', label: 'Tout' },
  { id: '80s', label: 'Années 80' },
  { id: '90s', label: 'Années 90' },
  { id: '2000s', label: 'Années 2000' },
  { id: '2010s', label: 'Années 2010' },
  { id: 'current', label: 'Hits du moment' },
  { id: 'rap-fr', label: 'Rap français' },
  { id: 'chanson-fr', label: 'Chanson française' },
  { id: 'rock', label: 'Rock' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export interface RoomSettings {
  source: MusicSource;
  /** URL ou ID d'une playlist YouTube (source "playlist") */
  playlistUrl: string;
  /** Thème musical (source "random") */
  theme: ThemeId;
  rounds: number;
  /** Durée d'écoute d'une manche, en secondes */
  roundDuration: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  /** Progression sur la manche en cours */
  foundTitle: boolean;
  foundArtist: boolean;
}

export interface RoomState {
  code: string;
  status: RoomStatus;
  phase: RoundPhase;
  settings: RoomSettings;
  players: PlayerInfo[];
  round: number;
  totalRounds: number;
}

export interface RoundPrepare {
  round: number;
  totalRounds: number;
  videoId: string;
  /** Position de départ dans la vidéo, en secondes */
  startSeconds: number;
}

export interface RoundStart extends RoundPrepare {
  /** Timestamp serveur (ms) auquel la musique doit démarrer */
  startAt: number;
  /** Timestamp serveur (ms) de fin de la manche */
  endsAt: number;
}

export interface TrackReveal {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
}

export interface GuessResult {
  /** Ce que le joueur vient de trouver avec cette proposition */
  title: boolean;
  artist: boolean;
  points: number;
}

export type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };
export type Ack<T> = (res: AckResponse<T>) => void;

export interface ClientToServerEvents {
  'room:create': (payload: { name: string }, ack: Ack<RoomState>) => void;
  'room:join': (payload: { code: string; name: string }, ack: Ack<RoomState>) => void;
  'room:leave': () => void;
  'room:settings': (settings: Partial<RoomSettings>) => void;
  'game:start': (ack: Ack<null>) => void;
  /** La vidéo de la manche est chargée et prête à jouer */
  'round:ready': (round: number) => void;
  guess: (text: string, ack: (res: GuessResult) => void) => void;
  'time:sync': (ack: (serverNow: number) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'round:prepare': (round: RoundPrepare) => void;
  'round:start': (round: RoundStart) => void;
  'round:end': (payload: { track: TrackReveal }) => void;
}

export const LIMITS = {
  nameMaxLength: 20,
  rounds: { min: 1, max: 50, default: 10 },
  roundDuration: { min: 10, max: 60, default: 30 },
} as const;
