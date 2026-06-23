# Tunisia Scope Insight

Application PFE pour evaluer la maturite digitale et data d'une organisation:
questionnaire, scoring, rapport PDF, sauvegarde Supabase et rapport IA OpenAI.

## Demarrage local

1. Installer les dependances:

```bash
npm install
```

2. Creer le fichier local `.env` a partir de `.env.example`, puis renseigner:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
BACKOFFICE_PASSCODE
OPENAI_API_KEY_ENCRYPTION_SECRET
```

3. Lancer l'application:

```bash
npm run dev
```

## Infra Supabase

Les migrations creent:

- `public.scoring_test_submissions` pour stocker les reponses et scores.
- `public.ai_report_settings` pour stocker la configuration du rapport IA.
- `public.update_ai_report_settings(...)` pour sauvegarder la configuration backoffice.

Appliquer les migrations sur le projet Supabase cible:

```bash
npm run infra:supabase
```

Le script accepte `SUPABASE_DB_URL`, ou bien `SUPABASE_PROJECT_REF` + `PGPASSWORD`.
Si `BACKOFFICE_PASSCODE` est present, le hash utilise par la fonction SQL est aligne
automatiquement avec ce passcode.

## Infra OpenAI

La generation IA du rapport utilise l'API OpenAI Responses. La cle API se renseigne
dans le backoffice et est stockee chiffree cote serveur/Supabase. Elle n'est jamais
renvoyee au navigateur.

Configurer aussi un secret serveur stable pour le chiffrement:

```bash
OPENAI_API_KEY_ENCRYPTION_SECRET=...
```

Sans ce secret, l'application utilise `BACKOFFICE_PASSCODE` comme cle de chiffrement.
`OPENAI_API_KEY` reste accepte comme fallback serveur optionnel si aucune cle n'est
encore sauvegardee dans le backoffice.

## Deploiement Netlify

Le projet inclut `netlify.toml` pour eviter les erreurs de detection automatique:

- Node.js 22 est force via `.node-version` et `NODE_VERSION`.
- Netlify publie `dist/client`.
- Le plugin officiel `@netlify/vite-plugin-tanstack-start` est active pendant les builds Netlify.
- Les `devDependencies` restent installees pendant le build avec `NPM_FLAGS=--include=dev`.

Dans Netlify, verifier aussi les variables d'environnement:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
BACKOFFICE_PASSCODE
OPENAI_API_KEY_ENCRYPTION_SECRET
```

## Verification avant livraison

```bash
npm run lint
npm run typecheck
npm run build
```
