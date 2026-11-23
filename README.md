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

4. Open **SQL Editor**, paste all of
   `supabase/migrations/20261123000000_prism_platform.sql` and run it once.
5. Make yourself the owner of team 935 (which is what unlocks `/admin`):
   `select public.prism_bootstrap_owner(935, 'the-email-you-signed-up-with');`

## Teams, roles and the consoles

- **Sign-up** asks for a team number. After the email is confirmed and the person signs
  in, the first account for a number founds that team as its **owner**. Later accounts
  for the same number wait as **pending** until an owner or admin accepts them; they
  join as **developers** and can be promoted to **admin**.
- **`/dashboard`** (every team): members and join requests, devices, test programs,
  community posts and account settings.
- **`/pair`**: a phone or tablet scans the QR code from *Dashboard → Devices → Add
  device* (or types the 8-character code). Its secret token stays on that device; only a
  hash is stored. Admins then choose which software each device may run, and on which
  channel.
- **`/admin`** (active members of team 935 only): every team, account and device,
  software and releases, test programs, community moderation, and the homepage
  announcement and sign-up switch.

All of this is enforced in Postgres (row-level security, column grants and
`SECURITY DEFINER` functions in the migration). The browser code only shapes requests.

Because the site is a static export, the two `NEXT_PUBLIC_` values are baked in at build
time: a deploy pipeline needs them set as build environment variables.
