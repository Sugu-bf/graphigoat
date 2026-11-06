# GraphiGOAT

Landing page construite avec Landing Forge (HTML, CSS, TypeScript, GSAP, Vite).

## Lancer

```bash
npm install
npm run dev
```

Puis ouvrir l'adresse affichée (http://localhost:5173).

## Modifier

- **Textes et sections** : `index.html` (une section par bloc de la page).
- **Couleurs, polices, tailles** : `src/styles/tokens.css`.
- **Mise en page** : `src/styles/site.css`.
- **Effets** : chaque élément animé porte `data-effect="nom"` ; le code est dans `src/effects/nom/`, ses options dans
  `src/effects/nom/effect.json`.
- **Images** : déposer les originaux dans un dossier, puis `npm run media -- chemin/des/images` (formats AVIF et WebP
  aux bonnes tailles, code HTML à copier).

## Vérifier avant de livrer

```bash
npm run build
npm run preview
```

Dans un second terminal, pendant que `preview` tourne :

```bash
npm run qa -- --url http://localhost:4173 --motion both
```

Le rapport est dans `qa/report.md` (erreurs, débordements, accessibilité, poids, vitesse) avec les captures.

## Mettre en ligne

`npm run build` produit le dossier `dist/`, à publier tel quel (Netlify, Vercel, Cloudflare Pages, ou tout hébergement
statique). `netlify.toml` est déjà prêt pour Netlify.

## Documents du projet

- `docs/BRIEF.md` : ce qui a été demandé, ce qui a été supposé.
- `docs/DESIGN.md` : la direction artistique et ses raisons.
- `docs/CREDITS.md` : sources et licences des ressources.
