Stripe → Supabase Webhook Add-on

Files:
  - lib/supabaseAdmin.ts            (server-only Supabase client with service role key)
  - app/api/stripe/webhook/route.ts (webhook handler that upserts subscription state)
  - sql/stripe_billing.sql          (run in Supabase SQL editor)

Setup steps:
1) In Supabase Dashboard:
   - Copy your project URL.
   - Copy the Service Role key (Settings → API → Service Role).

2) In your project's .env.local, set:
   NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY     # server-only, do not expose to client

3) Replace your webhook route with the provided file, or merge the upsert logic into your existing route.

4) Run the SQL in Supabase (SQL editor):
   sql/stripe_billing.sql

5) Restart your dev server after env changes:
   npm run dev

6) With Stripe CLI running:
   stripe listen --forward-to http://localhost:3000/api/stripe/webhook
   stripe trigger checkout.session.completed

This will create/update a row in the 'stripe_billing' table with the latest subscription info.
Later, when you have user accounts, link rows to your users and enable RLS with proper policies.
