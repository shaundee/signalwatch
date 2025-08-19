Customer Portal (Lookup from Supabase)

This add-on opens the Stripe Customer Portal by looking up the Stripe customer ID
stored in the 'stripe_billing' table (populated by your webhook). It uses the
currently signed-in user's email to find the matching row.

Files:
  - app/api/billing-portal/route.ts
  - components/ManageBillingFromDB.tsx

Requirements:
  - Supabase project set up.
  - stripe_billing table created (see previous SQL).
  - Webhook writing rows with email + stripe_customer_id.
  - Users sign in with the SAME email they used at Stripe Checkout.

Steps:
1) Copy these files into your project root, preserving folders.
2) Ensure .env.local has:
     NEXT_PUBLIC_SUPABASE_URL=...
     NEXT_PUBLIC_SUPABASE_ANON_KEY=...
     SUPABASE_SERVICE_ROLE_KEY=...   # server-only (used by supabaseAdmin)
3) Render the button on a page:
     import ManageBillingFromDB from "@/components/ManageBillingFromDB";
     <ManageBillingFromDB />
4) Sign in via your /signin flow using the same email used to pay in Stripe.
5) Click "Manage billing" → opens Stripe Customer Portal.

Security note:
  For production, verify the Supabase session server-side (e.g., using @supabase/ssr or your own auth)
  and resolve the customer ID on the server using the authenticated user ID/email, rather than accepting
  arbitrary email from the client.
