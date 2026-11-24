# The Prism Protocol site

This repository contains the public site and team beta portal for The Prism Protocol (TPP).
TPP is a JavaScript library that gives scouting systems a shared way to describe, validate,
read, write and convert match data. It is designed to work with existing scouting apps after
their developers integrate it; it does not replace those apps or connect them automatically.

The library supports nine data formats, typed metric definitions, validation, and custom
metrics and formats. A separate configurable scouting app is the no-code product direction;
it is not part of TPP itself. The library implementation is maintained separately from this
site repository: [github.com/team935scouting/prism-protocol](https://github.com/team935scouting/prism-protocol).

## Develop the site

```sh
npm install
npm run dev     # http://localhost:3000
npm run build   # static export to out/ (includes CNAME for GitHub Pages)
```

## Where things are

- `app/` – page composition, metadata and global styles
- `components/PrismScene.tsx` – prism visual used on the public site and beta page
- `components/LiquidGlass.tsx` – Liquid Glass material for navigation and controls
- `components/HowItWorks.tsx` – a CSV-to-TPP-to-YAML match record example
- `components/Developers.tsx` – JavaScript integration examples for parsing and conversion
- `.claude/skills/anti-slop/` – design and copy guidance for this site

## Team beta portal (Supabase)

`/beta` signs people up and in with Supabase Auth. The portal supports team accounts,
developer beta programs, release notices and community feedback. Its team and device
administration tools are site infrastructure, not capabilities provided by the TPP library
or the separate no-code scouting app.

1. Create a Supabase project, then copy `.env.example` to `.env.local` and fill in the
   project URL and anon (publishable) key from **Project Settings → API**.
2. In **Authentication → URL Configuration**, set the Site URL to
   `https://theprisimprotocol.dev` and add these redirect URLs:
   `https://theprisimprotocol.dev/beta` and `http://localhost:3000/beta`.
3. Leave **Confirm email** on. New accounts get a confirmation link that lands back on
   `/beta`. Password resets work the same way.
4. Open **SQL Editor** and run the files in `supabase/migrations/` in timestamp order.
5. Make yourself the owner of team 935 (which unlocks `/admin`):
   `select public.prism_bootstrap_owner(935, 'the-email-you-signed-up-with');`

## Portal roles and pages

- The first account for a team number becomes its **owner**. Later signups wait as
  **pending** until an owner or admin accepts them. Accepted accounts join as **developers**
  and can be promoted to **admin**.
- **`/dashboard`**: members and join requests, devices, beta programs, community posts and
  account settings.
- **`/pair`**: a portal utility for pairing a device to a team account. It is separate from
  TPP's data-format and validation features.
- **`/admin`** (active members of team 935 only): team accounts and devices, beta releases,
  test programs, community moderation, and public-site settings.

Portal access is enforced in Postgres (row-level security, column grants and
`SECURITY DEFINER` functions in the migration). The browser code only shapes requests.

Because the site is a static export, the two `NEXT_PUBLIC_` values are baked in at build
time: a deploy pipeline needs them set as build environment variables.
