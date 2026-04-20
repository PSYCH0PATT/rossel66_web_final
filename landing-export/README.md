# Rossel Music — Landing Page Source

## What this is
Current landing page for **Rossel Music**, a music distribution label for independent Russian artists.
Stack: **Next.js 14 App Router + Tailwind CSS + TypeScript**.

## Brand
- **Primary color**: `#10b981` (emerald green)
- **Secondary**: `#0ea5e9` (azure/sky blue)
- **Background**: `#ffffff` (light — public site) / `#0a0a0a` (dark — admin dashboard)
- **Heading font**: Syncopate (all caps, display)
- **Body font**: Nunito Sans

## Page structure (`page.tsx`)
The main page renders these sections top to bottom:
1. `Navbar` — sticky top nav with logo + links + CTA button
2. `Hero` — full-height hero with animated background, headline, subtext, CTA
3. `ServicesSection` — grid of distribution services / features
4. `ArtistsSection` — showcase of signed artists with photos
5. `PartnersSection` — logos of DSPs (Spotify, Apple Music, Yandex Music, VK, etc.)
6. `FactsSection` — stats/numbers about the label
7. `FaqSection` — accordion FAQ
8. `ContactSection` / `ContactFormSection` — contact form + info
9. `Footer`

## Files in this directory
| File | Description |
|------|-------------|
| `page.tsx` | Main page — composes all sections |
| `layout.tsx` | Root layout — fonts, metadata |
| `globals.css` | Global CSS + CSS variables (light theme) |
| `tailwind.config.js` | Tailwind config — custom colors, fonts |
| `hero.tsx` | Hero section |
| `navbar.tsx` | Navigation bar |
| `footer.tsx` | Footer |
| `services-section.tsx` | Services / features grid |
| `artists-section.tsx` | Artists showcase |
| `partners-section.tsx` | DSP partner logos |
| `facts-section.tsx` | Stats section |
| `faq-section.tsx` | FAQ accordion |
| `contact-section.tsx` | Contact info |
| `contact-form-section.tsx` | Contact form |
| `background-animation.tsx` | Animated background (hero) |
| `custom-cursor.tsx` | Custom cursor component |
| `sparkles.tsx` | Sparkle particle effect |
| `scroll-arrow.tsx` | Scroll indicator arrow |

## Design goals for redesign
- **Target**: very modern, unique 2026 aesthetic
- **Animations**: scroll-driven reveals, cursor-tracking, staggered text entrance, parallax
- **Vibe**: premium music industry — dark/light contrast, glass morphism accents, bold typography
- **Keep**: brand colors (emerald + azure), Syncopate for headers, Nunito Sans for body
- **Improve**: hero impact, services clarity, mobile experience, overall "wow" factor
