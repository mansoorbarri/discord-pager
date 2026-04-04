## Convex Persistence Setup

This bot now stores persistent bot state in Convex instead of local JSON files.

Currently this includes:

- ATC schedules
- Role backups used by `/questioning` and `/unquestioning`

### Required bot environment variables

Set these in `.env.local` for local development or in your deployment environment for production:

```env
CONVEX_URL=
CONVEX_SITE_URL=
CONVEX_BOT_SHARED_SECRET=
```

The bot loads `.env.local` first, then `.env`.

### Required Convex deployment environment variables

Set the same shared secret in the Convex deployment:

```bash
npx convex env set CONVEX_BOT_SHARED_SECRET your-secret-here
```

### Local development

1. Start Convex locally:

```bash
pnpm convex:dev
```

2. Start the bot in a separate shell:

```bash
pnpm start
```

### Notes

- ATC schedule writes go through secret-gated Convex HTTP actions.
- The bot keeps a single realtime Convex query subscription for the active schedule cache.
- The bot also keeps a realtime Convex query subscription for role backup state.
- If `CONVEX_BOT_SHARED_SECRET` is missing on either side, startup fails fast.
