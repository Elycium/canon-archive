# Canon

A living archive of the prompts, system prompts, and frameworks you build — searchable by meaning, runnable with Grok.

## Local

```bash
npm install
npm run dev
```

Dev server: `http://localhost:8080`.

Sign in with Google or X. First visit seeds a starter library so semantic search works immediately.

## What it does

- Capture prompts / system prompts / frameworks — Grok classifies and indexes them
- Semantic search over your library (hashed vectors + Grok phrases)
- Run a piece live with Grok, then file the reply as a version or a new piece
- Living Canon document distilled from the archive

## Env

| Variable | Purpose |
| --- | --- |
| `XAI_API_KEY` | Grok classify, search deepen, Run with Grok, Canon rebuild |
| `DATABASE_URL` | Neon/Postgres in production; omitted uses embedded PGLite |
| `VITE_AUTH_ENABLED` | Set `false` only to skip sign-in (dev user) |
