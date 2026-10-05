import type { PlayerInfo } from '@earlier/shared';
import { socket } from '../socket';

export default function PlayerList({ players, showProgress = false }: { players: PlayerInfo[]; showProgress?: boolean }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <ul className="space-y-2">
      {sorted.map((p) => (
        <li
          key={p.id}
          className={`flex items-center justify-between rounded-lg px-3 py-2 ${p.id === socket.id ? 'bg-fuchsia-950/50' : 'bg-zinc-800/50'}`}
        >
          <span className="flex items-center gap-2">
            {p.name}
            {p.isHost && <span className="text-xs text-amber-400">hôte</span>}
          </span>
          <span className="flex items-center gap-3">
            {showProgress && (
              <span className="flex gap-1 text-xs">
                <Badge on={p.foundArtist}>A</Badge>
                <Badge on={p.foundTitle}>T</Badge>
              </span>
            )}
            <span className="w-8 text-right font-mono font-bold">{p.score}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Badge({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded px-1.5 py-0.5 font-bold ${on ? 'bg-emerald-600 text-white' : 'bg-zinc-700 text-zinc-500'}`}>
      {children}
    </span>
  );
}
