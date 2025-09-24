Stripe Customer Portal Add-on

Files:
  - app/api/billing-portal/route.ts
  - components/ManageBillingButton.tsx

How to use:
1) Copy these files into your project root, preserving the folder structure.
2) Ensure your subscription Checkout success URL includes the placeholder:
     success_url: `${baseUrl}/?sub=success&session_id={CHECKOUT_SESSION_ID}`
3) On any page (e.g., app/page.tsx), import and render the button:
     import ManageBillingButton from "@/components/ManageBillingButton";
     // in JSX:
     <ManageBillingButton />
4) With a successful checkout redirect, clicking "Manage billing" will open the Stripe Customer Portal
   using the customer derived from the session_id.
5) Later, once you store the Stripe customer ID in your DB, you can POST { customerId } from the server
   instead of relying on session_id.

Env requirements:
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  STRIPE_SECRET_KEY=sk_test_...
