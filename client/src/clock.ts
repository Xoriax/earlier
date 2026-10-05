import { socket } from './socket';

let offset = 0;

/** Heure du serveur estimée, en ms */
export function serverNow(): number {
  return Date.now() + offset;
}

/** Estime le décalage d'horloge avec le serveur en gardant l'échantillon au plus faible aller-retour */
export async function syncClock(samples = 5): Promise<void> {
  let best = { rtt: Infinity, offset: 0 };
  for (let i = 0; i < samples; i++) {
    const sentAt = Date.now();
    const serverTime = await socket.emitWithAck('time:sync');
    const receivedAt = Date.now();
    const rtt = receivedAt - sentAt;
    if (rtt < best.rtt) best = { rtt, offset: serverTime - (sentAt + rtt / 2) };
  }
  offset = best.offset;
}

socket.on('connect', () => void syncClock());
