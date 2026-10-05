import { useEffect, useState } from 'react';
import type { RoomState, RoundPrepare, RoundStart, TrackReveal } from '@earlier/shared';
import { socket } from './socket';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';
import Results from './components/Results';

export default function App() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [round, setRound] = useState<RoundPrepare | RoundStart | null>(null);
  const [reveal, setReveal] = useState<TrackReveal | null>(null);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onRound = (r: RoundPrepare | RoundStart) => {
      setRound(r);
      setReveal(null);
    };
    const onRoundEnd = ({ track }: { track: TrackReveal }) => setReveal(track);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setRoom(null);
    };

    socket.on('room:state', setRoom);
    socket.on('round:prepare', onRound);
    socket.on('round:start', onRound);
    socket.on('round:end', onRoundEnd);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('room:state', setRoom);
      socket.off('round:prepare', onRound);
      socket.off('round:start', onRound);
      socket.off('round:end', onRoundEnd);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const leave = () => {
    socket.emit('room:leave');
    setRoom(null);
    setRound(null);
    setReveal(null);
  };

  let screen;
  if (!room) screen = <Home onJoined={setRoom} />;
  else if (room.status === 'lobby') screen = <Lobby room={room} onLeave={leave} />;
  else if (room.status === 'playing') screen = <Game room={room} round={round} reveal={reveal} onLeave={leave} />;
  else screen = <Results room={room} onLeave={leave} />;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">
          earlier<span className="text-fuchsia-500">.</span>
        </h1>
        {!connected && <span className="text-sm text-amber-400">Connexion au serveur…</span>}
      </header>
      <main className="flex-1">{screen}</main>
    </div>
  );
}
