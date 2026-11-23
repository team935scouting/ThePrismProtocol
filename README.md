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
