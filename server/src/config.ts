try {
  process.loadEnvFile();
} catch {
  // pas de .env : on se contente des variables d'environnement
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? '',
};

if (!config.youtubeApiKey) {
  console.warn('[config] YOUTUBE_API_KEY manquante : impossible de charger les playlists.');
}
