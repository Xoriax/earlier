import { useEffect, useState } from 'react';
import type { RoomSettings, RoomState } from '@earlier/shared';
import { LIMITS, THEMES } from '@earlier/shared';
import { socket, unwrap } from '../socket';
import { Button, Card, ErrorText, Input } from './ui';
import PlayerList from './PlayerList';

export default function Lobby({ room, onLeave }: { room: RoomState; onLeave: () => void }) {
  const isHost = room.players.some((p) => p.id === socket.id && p.isHost);
  const [playlistUrl, setPlaylistUrl] = useState(room.settings.playlistUrl);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPlaylistUrl(room.settings.playlistUrl);
  }, [room.settings.playlistUrl]);

  const update = (patch: Partial<RoomSettings>) => socket.emit('room:settings', patch);

  const start = async () => {
    setError('');
    setStarting(true);
    try {
      unwrap(await socket.emitWithAck('game:start'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lancer la partie.');
    } finally {
      setStarting(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${location.origin}/?room=${room.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">Code de la partie</p>
          <p className="font-mono text-4xl font-black tracking-[0.3em]">{room.code}</p>
        </div>
        <Button variant="ghost" onClick={copyLink}>
          {copied ? 'Lien copié !' : 'Copier le lien'}
        </Button>
      </Card>

      <div className="grid gap-6 sm:grid-cols-[1fr_16rem]">
        <Card className="space-y-4">
          <h2 className="text-lg font-bold">Réglages</h2>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-800 p-1">
            {(
              [
                ['random', 'Aléatoire'],
                ['playlist', 'Ma playlist'],
              ] as const
            ).map(([source, label]) => (
              <Chip
                key={source}
                active={room.settings.source === source}
                disabled={!isHost}
                onClick={() => update({ source })}
              >
                {label}
              </Chip>
            ))}
          </div>
          {room.settings.source === 'random' ? (
            <div>
              <label className="mb-2 block text-sm text-zinc-400">Thème</label>
              <div className="flex flex-wrap gap-2">
                {THEMES.map((theme) => (
                  <Chip
                    key={theme.id}
                    active={room.settings.theme === theme.id}
                    disabled={!isHost}
                    onClick={() => update({ theme: theme.id })}
                  >
                    {theme.label}
                  </Chip>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Playlist YouTube (lien ou ID)</label>
              <Input
                value={playlistUrl}
                disabled={!isHost}
                placeholder="https://www.youtube.com/playlist?list=..."
                onChange={(e) => setPlaylistUrl(e.target.value)}
                onBlur={() => playlistUrl !== room.settings.playlistUrl && update({ playlistUrl })}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="Manches"
              value={room.settings.rounds}
              limits={LIMITS.rounds}
              disabled={!isHost}
              onChange={(rounds) => update({ rounds })}
            />
            <NumberField
              label="Durée (s)"
              value={room.settings.roundDuration}
              limits={LIMITS.roundDuration}
              disabled={!isHost}
              onChange={(roundDuration) => update({ roundDuration })}
            />
          </div>
          {isHost ? (
            <Button
              className="w-full"
              disabled={starting || (room.settings.source === 'playlist' && !playlistUrl.trim())}
              onClick={start}
            >
              {starting ? 'Chargement des musiques…' : 'Lancer la partie'}
            </Button>
          ) : (
            <p className="text-center text-sm text-zinc-400">En attente de l'hôte…</p>
          )}
          <ErrorText>{error}</ErrorText>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">Joueurs ({room.players.length})</h2>
          <PlayerList players={room.players} />
        </Card>
      </div>

      <Button variant="ghost" onClick={onLeave}>
        Quitter
      </Button>
    </div>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  limits: { min: number; max: number };
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-400">{props.label}</label>
      <Input
        type="number"
        min={props.limits.min}
        max={props.limits.max}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => e.target.value && props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Chip(props: { active: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-default ${
        props.active ? 'bg-fuchsia-600 text-white' : 'bg-zinc-800 text-zinc-300 enabled:hover:bg-zinc-700'
      }`}
    >
      {props.children}
    </button>
  );
}
