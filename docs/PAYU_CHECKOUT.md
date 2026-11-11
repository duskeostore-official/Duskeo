# PayU Hosted Checkout

The cart uses PayU Hosted Checkout. Customers sign in, select a saved delivery address, and choose a payment method on PayU. The storefront only displays the thank-you confirmation after the PayU response hash and the server-to-server `verify_payment` result are verified and the order is marked placed in Supabase.

## Configure Supabase

In the Supabase project dashboard, add these Edge Function secrets:

- `PAYU_MERCHANT_KEY` and `PAYU_MERCHANT_SALT` — the matching test credentials
- `PAYU_LIVE_MERCHANT_KEY` and `PAYU_LIVE_MERCHANT_SALT` — the matching production credentials
- `PAYU_ENV` — `test` or `production` (defaults to `test`)
- `STORE_URL` — the public HTTPS URL of the storefront, without a path

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Do not put the merchant salt or service-role key in a `VITE_` variable, frontend code, or a committed environment file. Do not send secrets in chat.

The checkout and callback functions select the matching credential pair based on `PAYU_ENV`; keep test and production credentials separate.

Apply the database migration and deploy both functions from the repository root:

```powershell
supabase db push
supabase functions deploy payu-hosted-checkout
supabase functions deploy payu-callback
supabase functions deploy payu-confirm-payment
```

The callback is public because PayU posts to it; it verifies the PayU response hash and checks the transaction with PayU before changing an order. The checkout-creation and payment-confirmation functions require the signed-in customer and verify order ownership.

## Before going live

1. Configure the matching test merchant key and salt, set `PAYU_ENV=test`, and use the public test storefront URL.
2. Verify a successful payment, a failed payment, and a return with an unverified or mismatched amount. Only the verified, placed order should show “Thank you for your order.”
3. Configure the production merchant key and salt together, set `PAYU_ENV=production`, and deploy again.

PayU must be able to reach the Supabase callback URL:

```text
https://<project-ref>.supabase.co/functions/v1/payu-callback
```

The callback URL is sent as both PayU success and failure URLs during checkout.

References: [PayU Hosted Checkout](https://docs.payu.in/docs/prebuilt-checkout-payu-hosted) · [Web Integration](https://docs.payu.in/docs/prebuilt-checkout-page-integration) · [Hashing request and response](https://docs.payu.in/docs/hashing-request-and-response) · [Verify Payment API](https://docs.payu.in/reference/verify_payment_api)
