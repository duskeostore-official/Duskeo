# Razorpay Setup

Checkout uses Supabase Edge Functions for order creation, payment verification, and webhooks. Razorpay secret keys are never sent to the browser.

## Configure test mode

1. Create Razorpay Test Mode API keys in the Razorpay dashboard.
2. Link the Supabase CLI to this project, then add the keys as Edge Function secrets:

   ```sh
   supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=your_test_secret RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   ```

   Do not add these values to `.env`, source control, or the Vite frontend.

3. Deploy the three functions:

   ```sh
   supabase functions deploy razorpay-create-order
   supabase functions deploy razorpay-verify-payment
   supabase functions deploy razorpay-webhook
   ```

   Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

4. In Razorpay Webhooks, add:

   ```text
   https://<project-ref>.supabase.co/functions/v1/razorpay-webhook
   ```

   Use the same webhook secret as `RAZORPAY_WEBHOOK_SECRET`, and subscribe to `payment.authorized`, `payment.captured`, and `payment.failed`.

5. Sign in to DUSKEO, save a delivery address, add an in-stock item, and complete a Test Mode payment from the cart drawer.

## Production

After test payments and webhook delivery are verified, replace the three Edge Function secrets with Razorpay Live Mode values and update the Razorpay webhook endpoint to use the live account. Never expose `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` in client-side environment variables.