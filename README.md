# The Prism Protocol

Marketing site for Prism: an open protocol plus a Raspberry Pi OS image that handles
Bluetooth between scouting devices and gives any scouting app clean JSON over the
local network.

## Develop

```sh
npm install
npm run dev     # http://localhost:3000
npm run build   # static export to out/ (includes CNAME for GitHub Pages)
```

## Where things are

- `app/` – layout, global tokens (`globals.css`), page composition
- `components/PrismScene.tsx` – the hero: a glass prism (React Three Fiber,
  `MeshTransmissionMaterial`) recombining six scout beams into one
- `components/LiquidGlass.tsx` – Liquid Glass material: per-element SVG displacement map
  applied through `backdrop-filter` in Chromium, frosted fallback elsewhere
- `components/HowItWorks.tsx` – scroll-driven four-step diagram
- `.claude/skills/anti-slop/` – design rules every UI change here is checked against

## Developer beta accounts (Supabase)

`/beta` signs people up and in with Supabase Auth, straight from the browser.

1. Create a Supabase project, then copy `.env.example` to `.env.local` and fill in the
   project URL and anon (publishable) key from **Project Settings → API**.
2. In **Authentication → URL Configuration**, set the Site URL to
   `https://theprisimprotocol.dev` and add these redirect URLs:
   `https://theprisimprotocol.dev/beta` and `http://localhost:3000/beta`.
3. Leave **Confirm email** on. New accounts get a confirmation link that lands back on
   `/beta`. Password resets work the same way.

Name, team number and the "email me about builds" choice are stored on each user as
metadata (`raw_user_meta_data`), visible under **Authentication → Users**. No tables or
row-level-security policies are needed for the beta as it stands.

Because the site is a static export, the two `NEXT_PUBLIC_` values are baked in at build
time: a deploy pipeline needs them set as build environment variables.
