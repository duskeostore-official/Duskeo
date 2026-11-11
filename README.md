# React + TypeScript + Vite

## NimbusPost rate checks

When an order is confirmed as placed, a database trigger snapshots the matching preset for each warehouse parcel in `order_shipping_packages`. The admin order screen automatically requests serviceability and courier rates when that placed order is expanded. Preset edits apply to later orders; existing orders keep their saved package unless an admin overrides it. Presets are stored in `shipping_package_presets` and selected by the total item quantity in each warehouse parcel:

- 1 T-shirt: 500 g, 30 × 25 × 5 cm
- 2 T-shirts: 900 g, 32 × 28 × 7 cm
- 3 or more T-shirts: 1300 g, 35 × 30 × 10 cm

Admins can edit each preset in **Shipping Package Settings** and override parcel details for an exceptional order. NimbusPost booking uses the same package values as the rate check. Booking requires an explicit confirmation because NimbusPost can charge the shipping wallet. The server reserves each item set before calling NimbusPost and keeps ambiguous attempts locked to prevent duplicate bookings; check NimbusPost by the displayed order reference before retrying an uncertain request. Successful bookings save the NimbusPost order ID, courier, AWB, tracking URL and package snapshot to the shipment record.

Apply `supabase/migrations/014_nimbuspost_package_presets.sql` before deploying the updated `nimbuspost-serviceability` and new `nimbuspost-create-shipment` Edge Functions. Configure these values as Supabase Edge Function secrets (never in frontend variables or committed files):

- `NIMBUSPOST_API_KEY`
- `NIMBUSPOST_API_SECRET`
- `NIMBUSPOST_PICKUP_PINCODE`

The Edge Functions also require Supabase's standard `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets. NimbusPost API credentials should only be generated and stored through a secure channel; rotate any key whose secret was exposed.

Run package-selection unit tests with `npm run test:shipping-packages`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
