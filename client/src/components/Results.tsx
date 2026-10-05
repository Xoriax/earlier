import { useState } from 'react';
import type { RoomState } from '@earlier/shared';
import { socket, unwrap } from '../socket';
import { Button, Card, ErrorText } from './ui';
import PlayerList from './PlayerList';

export default function Results({ room, onLeave }: { room: RoomState; onLeave: () => void }) {
  const isHost = room.players.some((p) => p.id === socket.id && p.isHost);
  const winner = [...room.players].sort((a, b) => b.score - a.score)[0];
  const [error, setError] = useState('');

  const replay = async () => {
    setError('');
    try {
      unwrap(await socket.emitWithAck('game:start'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de relancer.');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="text-center">
        <p className="text-sm text-zinc-400">Victoire de</p>
        <p className="text-4xl font-black text-fuchsia-500">{winner?.name}</p>
        <p className="font-mono text-zinc-400">{winner?.score} pts</p>
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-bold">Classement</h2>
        <PlayerList players={room.players} />
      </Card>
      <div className="flex gap-3">
        {isHost && <Button onClick={replay}>Rejouer</Button>}
        <Button variant="ghost" onClick={onLeave}>
          Quitter
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
