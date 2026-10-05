import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { RoomState, RoundPrepare, RoundStart, TrackReveal } from '@earlier/shared';
import { socket } from '../socket';
import { serverNow } from '../clock';
import { usePlayer } from './PlayerProvider';
import { Button, Card, Input } from './ui';
import PlayerList from './PlayerList';

type Feedback = { kind: 'success' | 'miss'; text: string } | null;

export default function Game({
  room,
  round,
  reveal,
  onLeave,
}: {
  room: RoomState;
  /** RoundPrepare pendant le chargement, RoundStart une fois le top départ fixé */
  round: RoundPrepare | RoundStart | null;
  reveal: TrackReveal | null;
  onLeave: () => void;
}) {
  const { player, onStateChangeRef, setSlot } = usePlayer();
  const [volume, setVolume] = useState(70);
  const [now, setNow] = useState(serverNow);
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const me = room.players.find((p) => p.id === socket.id);
  const foundAll = !!me?.foundTitle && !!me?.foundArtist;
  const isRevealed = room.phase === 'reveal' && !!reveal;

  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 200);
    return () => clearInterval(id);
  }, []);

  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
    player?.setVolume(volume);
  }, [player, volume]);

  const roundNumber = round?.round;
  const videoId = round?.videoId;
  const startSeconds = round?.startSeconds ?? 0;
  const startAt = round && 'startAt' in round ? round.startAt : null;
  const endsAt = round && 'endsAt' in round ? round.endsAt : null;

  const startedRef = useRef(false);
  const startAtRef = useRef(startAt);
  startAtRef.current = startAt;

  // 1. Dès l'annonce de la manche : chargement en muet, pause au point de départ, puis signal « prêt »
  useEffect(() => {
    if (!player || !videoId || roundNumber === undefined) return;
    startedRef.current = false;
    let readySent = false;
    let synced = false;

    onStateChangeRef.current = (state) => {
      if (state !== YT.PlayerState.PLAYING) return;
      if (!startedRef.current) {
        player.pauseVideo();
        if (!readySent) {
          readySent = true;
          socket.emit('round:ready', roundNumber);
        }
        return;
      }
      const start = startAtRef.current;
      if (!synced && start !== null) {
        synced = true;
        // Chargement lent ou arrivée en cours de manche : on se recale sur les autres joueurs
        const expected = startSeconds + (serverNow() - start) / 1000;
        if (Math.abs(player.getCurrentTime() - expected) > 1.5) player.seekTo(expected, true);
      }
    };

    player.mute();
    player.loadVideoById({ videoId, startSeconds });
    setGuess('');
    setFeedback(null);
    return () => {
      onStateChangeRef.current = null;
    };
  }, [player, roundNumber, videoId, startSeconds, onStateChangeRef]);

  // 2. Top départ fixé par le serveur une fois tout le monde prêt
  useEffect(() => {
    if (!player || startAt === null) return;
    const timeout = setTimeout(
      () => {
        startedRef.current = true;
        player.unMute();
        player.setVolume(volumeRef.current);
        player.playVideo();
      },
      Math.max(0, startAt - serverNow()),
    );
    return () => clearTimeout(timeout);
  }, [player, startAt]);

  // Le lecteur survit à l'écran de jeu : on coupe juste la musique en le quittant
  useEffect(
    () => () => {
      player?.stopVideo();
    },
    [player],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = guess.trim();
    if (!text) return;
    setGuess('');
    const res = await socket.emitWithAck('guess', text);
    if (res.title && res.artist) setFeedback({ kind: 'success', text: 'Artiste et titre trouvés ! +2' });
    else if (res.title) setFeedback({ kind: 'success', text: 'Titre trouvé ! +1' });
    else if (res.artist) setFeedback({ kind: 'success', text: 'Artiste trouvé ! +1' });
    else setFeedback({ kind: 'miss', text: `« ${text} » : raté` });
  };

  const countdown = startAt !== null ? Math.ceil((startAt - now) / 1000) : null;
  const remaining = endsAt !== null ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  const progress =
    startAt !== null && endsAt !== null ? Math.min(1, Math.max(0, (now - startAt) / (endsAt - startAt))) : 0;
  const listening = room.phase === 'playing' && countdown !== null && countdown <= 0;
  const canGuess = listening && !foundAll;

  let coverText = '?';
  if (room.phase === 'loading') coverText = '…';
  else if (room.phase === 'playing' && countdown !== null && countdown > 0) coverText = String(countdown);

  useEffect(() => {
    if (canGuess) inputRef.current?.focus();
  }, [canGuess]);

  return (
    <div className="grid gap-6 sm:grid-cols-[1fr_16rem]">
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            Manche {room.round} / {room.totalRounds}
          </span>
          {room.phase === 'loading' && <span>Chargement de la musique…</span>}
          {listening && <span className="font-mono">{remaining}s</span>}
        </div>

        {/* Le lecteur YouTube (PlayerProvider) vient se superposer à cet emplacement */}
        <div ref={setSlot} className="relative aspect-video overflow-hidden rounded-2xl bg-black">
          {!isRevealed && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900">
              <span className="text-7xl font-black text-fuchsia-500">
                {coverText}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-zinc-800">
            <div className="h-full bg-fuchsia-500 transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        {isRevealed ? (
          <Card className="text-center">
            <p className="text-2xl font-bold">{reveal.title}</p>
            <p className="text-zinc-400">{reveal.artist}</p>
          </Card>
        ) : (
          <form onSubmit={submit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={guess}
              disabled={!canGuess}
              placeholder={foundAll ? 'Bien joué, attends les autres…' : 'Artiste, titre, ou les deux…'}
              onChange={(e) => setGuess(e.target.value)}
              autoComplete="off"
            />
            <Button type="submit" disabled={!canGuess}>
              OK
            </Button>
          </form>
        )}

        {feedback && !isRevealed && (
          <p className={feedback.kind === 'success' ? 'text-emerald-400' : 'text-zinc-500'}>{feedback.text}</p>
        )}

        <label className="flex items-center gap-3 text-sm text-zinc-400">
          Volume
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="accent-fuchsia-500"
          />
        </label>
      </div>

      <div className="space-y-4">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Scores</h2>
          <PlayerList players={room.players} showProgress />
        </Card>
        <Button variant="ghost" className="w-full" onClick={onLeave}>
          Quitter
        </Button>
      </div>
    </div>
  );
}
