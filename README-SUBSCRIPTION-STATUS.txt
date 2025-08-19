Subscription Status Widget (from Supabase)

Shows the current user's Stripe subscription status by looking up the
'stripe_billing' row written by your webhook.

Files:
  - app/api/subscription-status/route.ts   (server: query by email)
  - components/SubscriptionStatus.tsx      (client: reads user email via Supabase, calls API)

Setup:
1) Ensure you already set up:
   - Supabase env vars in .env.local:
       NEXT_PUBLIC_SUPABASE_URL=...
       NEXT_PUBLIC_SUPABASE_ANON_KEY=...
       SUPABASE_SERVICE_ROLE_KEY=...
   - Table 'stripe_billing' created and webhook writing rows.

2) Copy these files into your project root, preserving folders.

3) Render the component on your dashboard page, e.g. app/dashboard/page.tsx:
     import SubscriptionStatus from "@/components/SubscriptionStatus";
     export default function Dashboard() {
       return (
         <div className="space-y-6">
           <SubscriptionStatus />
         </div>
       );
     }

4) Restart dev server: npm run dev

Notes:
- This simple version accepts the email the client reports. For production,
  verify the user's session server-side (e.g., @supabase/ssr) and resolve the
  customer on the server using the authenticated user identity.
