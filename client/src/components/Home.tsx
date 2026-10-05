import { useState, type FormEvent } from 'react';
import type { RoomState } from '@earlier/shared';
import { LIMITS } from '@earlier/shared';
import { socket, unwrap } from '../socket';
import { Button, Card, ErrorText, Input } from './ui';

const NAME_KEY = 'earlier:name';

function readStoredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export default function Home({ onJoined }: { onJoined: (room: RoomState) => void }) {
  const [name, setName] = useState(readStoredName);
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (action: () => Promise<RoomState>) => {
    setError('');
    setLoading(true);
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      // stockage indisponible : on garde juste le pseudo en mémoire
    }
    try {
      onJoined(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setLoading(false);
    }
  };

  const create = () => run(async () => unwrap(await socket.emitWithAck('room:create', { name })));
  const join = (e: FormEvent) => {
    e.preventDefault();
    run(async () => unwrap(await socket.emitWithAck('room:join', { code, name })));
  };

  return (
    <div className="space-y-6">
      <Card>
        <label className="mb-2 block text-sm text-zinc-400">Ton pseudo</label>
        <Input
          value={name}
          maxLength={LIMITS.nameMaxLength}
          placeholder="DJ Michel"
          onChange={(e) => setName(e.target.value)}
        />
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Créer une partie</h2>
            <p className="text-sm text-zinc-400">Choisis une playlist et invite tes amis avec le code.</p>
          </div>
          <Button onClick={create} disabled={loading || !name.trim()}>
            Créer
          </Button>
        </Card>

        <Card>
          <form onSubmit={join} className="flex flex-col gap-4">
            <h2 className="text-lg font-bold">Rejoindre</h2>
            <Input
              value={code}
              maxLength={4}
              placeholder="ABCD"
              className="text-center font-mono text-xl tracking-[0.5em] uppercase"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <Button type="submit" variant="ghost" disabled={loading || !name.trim() || code.length !== 4}>
              Rejoindre
            </Button>
          </form>
        </Card>
      </div>

      <ErrorText>{error}</ErrorText>
    </div>
  );
}
