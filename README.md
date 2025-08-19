# VATTrackify Starter (Path B: code-light)

Next.js (App Router) + TypeScript + Supabase + Stripe + OAuth stubs for Shopify & HMRC.

## Quick start

```bash
# 1) Copy this folder into your workspace and install deps
npm install    # or: yarn

# 2) Add env vars
cp .env.example .env.local
# Fill in Supabase, Stripe, Shopify, HMRC values

# 3) Run
npm run dev
```

### Notes

- **Auth**: Uses Supabase client helpers (edge-friendly) — add your Supabase URL & anon key.
- **Billing**: Minimal Stripe setup with a webhook route stub.
- **Shopify**: Simple OAuth start + callback routes to store access tokens (you wire storage).
- **HMRC**: OAuth start + callback ready for MTD VAT; swap `HMRC_BASE_URL` for live when ready.
- **Monorepo**: If you later move to a monorepo, this works as a package with Next workspaces.

## Scripts
- `dev` – starts dev server (Turbopack)
- `build` – production build
- `start` – start prod server
- `lint` – ESLint
- `typecheck` – TypeScript check

## Where to add your logic
- `app/(dashboard)` – signed-in app pages
- `app/api/*` – API routes (Stripe webhook, Shopify/HMRC OAuth)
- `lib/*` – SDK clients (Stripe, Supabase) & helpers

Security reminder: never commit real secrets. Use `.env.local`.
