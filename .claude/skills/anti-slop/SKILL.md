---
name: anti-slop
description: Design and copy review rules that keep web UI from looking AI-generated ("AI slop"), plus Liquid Glass guidance. Load before designing, building or reviewing any page, component, landing page or marketing copy in this repo, and run the checklist before calling UI work done.
---

# Anti-slop design rules

"AI slop" is UI that could belong to any product: defaults nobody chose. The cure is
specificity. Every color, font, radius, animation and sentence should exist because of
something true about *this* product. If you can't say why something is there, remove it.

Compiled from practitioner checklists (Refero's anti-ai-slop reference, the ux-skill
"Anti AI slop ban list") and Apple's Liquid Glass documentation. Treat them as strong
defaults, not physics: break one only with a stated reason.

## The four tests (run on every screen)

1. **Identity test** – Cover the logo. Could the first viewport belong to another company?
   If yes, add one detail only this product could have.
2. **Card test** – Remove the border, shadow, background and radius from a card. If nothing
   is lost, it was never a card. Cards are for interactive containers.
3. **Copy test** – Cut 30% of the words. If it reads better, keep cutting.
4. **Image test** – If the first viewport works without the hero visual, the visual is
   filler: make it the point or delete it.

## Typography
- Pair a distinctive display treatment with a quiet body face; don't use Inter for both.
- 3–4 weight/size levels for hierarchy. Display ≥ 32px, tight tracking at large sizes.
- Sentence case for headlines and buttons. All caps only for short labels, with tracking.
- No letter-spacing on body text. Body text left-aligned; don't center everything.
- Hero headline under 4 lines. No one-word italic/serif/gradient "highlight" in headlines.

## Color
- No default indigo/violet (#6366f1, #8b5cf6, #7c3aed) and no purple-to-blue gradients.
- One dominant neutral, one sharp accent, each with a fixed role. Don't let the CTA color
  become a section background.
- No rainbow gradient text, no animated rainbow borders, no glow on everything.
- Body text and accents meet WCAG AA (4.5:1).
- Dark vs light is a decision tied to content, not a default.

## Layout
- Avoid: centered hero stack, three equal cards with icons, left-text/right-image hero by
  reflex, the same padding and divider between every section.
- Vary section rhythm and weight. Vary radius by role (controls vs containers vs media).
- Mobile hero ≤ ~80vh so content peeks below. No horizontal scroll at 375px.

## Motion
- Motion signals state or explains a mechanism. No ambient spinning, pulsing or floating.
- Don't fade-up every element on scroll. One or two signature moments per page.
- At most one parallax/scroll-linked layer per view.
- Routine UI: 100–150ms. Significant transitions: 200–300ms. Use a deliberate
  cubic-bezier, never `linear` or bare `ease`. Animate transform and opacity only.
- Honor `prefers-reduced-motion` and `prefers-reduced-transparency`.
- Every control has rest, hover, focus-visible, active (and disabled) states. Nothing
  depends on hover alone.

## Icons, decoration, imagery
- No emoji as icons, bullets or decoration. One SVG icon style, consistent stroke.
- No abstract blobs, floating shapes, generic 3D filler or stock photos. If a visual
  exists, it explains the product (a real diagram, a real screenshot, a real object).
- No decorative colored left-stripe on cards; stripes mean status.

## Copy
- Banned filler: empower, leverage, unlock, seamless, revolutionize, transform,
  supercharge, next-generation, cutting-edge, "reimagine what's possible", "welcome to".
- Lead with what the thing does, in concrete nouns and verbs.
- No invented stats ("10,000+ users", "99.9% uptime"), fake testimonials, fake logos,
  "Jane Doe, CEO", lorem ipsum. Unknown numbers stay out.
- Don't number lists unless order matters.
- Headlines say something specific to this product, not a prompt-shaped slogan.

## Liquid Glass (Apple, WWDC25) – how to use it here
- Glass is the **functional layer**: navigation, toolbars, segmented controls, buttons
  floating over content. It is never a background for content and never on every panel.
- Its signature is **lensing**: the edge refracts what's behind it. Blur alone is
  old-style frosted glass, not Liquid Glass.
- Restraint: no glass on glass, color used sparingly inside controls, legibility first.
- Web technique: an SVG `<filter>` with `feImage` (a generated displacement map encoding
  edge-normal refraction in R/G, neutral 0.5 gray in the flat center) feeding
  `feDisplacementMap`, applied via `backdrop-filter: url(#id)`. This works in Chromium
  only; everything else gets `blur() saturate()` plus a specular rim (inset highlights).
- Keep text out of the displaced layer; put content above the filtered element.

## Done checklist
- [ ] Four tests pass on every section
- [ ] No banned colors, words, emoji icons, fake numbers or fake people
- [ ] Glass only on controls/navigation, with a non-Chromium fallback
- [ ] Reduced motion / transparency respected; focus states visible
- [ ] 375px width: no overflow, readable type, tappable targets ≥ 44px
