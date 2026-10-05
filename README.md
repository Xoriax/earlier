# earlier

Blind test multijoueur basé sur YouTube : crée une partie, partage le code à tes amis, et soyez les plus rapides à trouver l'artiste et le titre.

## Stack

| Dossier   | Rôle                                                                 |
| --------- | -------------------------------------------------------------------- |
| `client/` | React + Vite + Tailwind, lecteur YouTube (IFrame API)                 |
| `server/` | Node + Fastify + Socket.IO, logique de partie et appels YouTube Data API |
| `shared/` | Types TypeScript des événements échangés entre client et serveur    |

Toute la logique de jeu (minuteur, validation des réponses, scores) tourne côté serveur.

## Installation

Prérequis : Node.js 22+.

```bash
npm install
cp server/.env.example server/.env
```

Renseigne `YOUTUBE_API_KEY` dans `server/.env` :

1. [Google Cloud Console](https://console.cloud.google.com/) → créer un projet
2. *APIs & Services* → *Library* → activer **YouTube Data API v3**
3. *Credentials* → *Create credentials* → *API key*

## Lancer en dev

```bash
npm run dev
```

- Front : http://localhost:5173
- Serveur : http://localhost:3001

Le front passe par le proxy Vite pour Socket.IO, il n'y a rien d'autre à configurer.

## Jouer

1. Entre un pseudo et crée une partie
2. Choisis la source des musiques :
   - **Aléatoire** : choisis un thème (années 80, rap français, etc.) ; le serveur pioche des morceaux dans plusieurs playlists trouvées automatiquement
   - **Ma playlist** : colle le lien d'une playlist YouTube publique ou non répertoriée
3. Partage le code (ou le lien) à tes amis, puis lance la partie

Les morceaux déjà joués dans un salon ne reviennent pas quand on relance une partie.

Chaque manche : 1 point pour l'artiste, 1 point pour le titre. On peut donner les deux d'un coup.

## Quota YouTube

L'API est gratuite, avec un quota de 10 000 unités par jour.

| Action | Coût | Cache serveur |
| ------ | ---- | ------------- |
| Charger une playlist | ~2 unités par tranche de 50 vidéos | 6 h |
| Rechercher des playlists pour un thème (mode aléatoire) | 100 unités par requête | 24 h |

Les requêtes de recherche par thème sont définies dans `server/src/random.ts`.

## Scripts

| Commande            | Effet                               |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Lance serveur et client en parallèle |
| `npm run typecheck` | Vérifie les types de tous les packages |
| `npm run build`     | Build de production du client       |
