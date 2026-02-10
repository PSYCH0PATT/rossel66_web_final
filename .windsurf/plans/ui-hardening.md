# UI Hardening & Responsive Refresh Plan
This plan outlines the steps to audit every user-facing screen, fix the regressions highlighted in the 12 screenshots, and tighten the overall responsive system without breaking existing flows.

## 1. Baseline Audit & Issue Mapping
1. Reproduce each screenshot scenario (artists grid, login, admin dashboard, artist edit tabs, releases/reports/payouts tables, parser buttons, history lists) across key breakpoints (320px, 375px, 768px, 1024px, desktop).
2. Catalog concrete defects (overflowing cards, cropped headers/icons, illegible buttons, invisible tab panes, cramped tables) and note the owning components/pages in a shared checklist.
3. Identify shared primitives (card, tab switcher, data table, header, icon button) whose token/spacing updates will fix multiple screens simultaneously.

## 2. Responsive Layout Refactors
1. **Card grid & artist tiles:** switch to CSS Grid with `auto-fill` + min width clamps, enforce internal padding/ellipsis for text, and scale avatar/icon sizes via CSS variables.
2. **Header & navigation:** implement breakpoint-specific layout (logo scaling, hamburger menu spacing, consistent mobile drawer styling) and ensure menu button never overlaps breadcrumbs.
3. **Action controls:** redesign dual-button clusters into stacked layout on narrow screens, add `gap` utilities, and enlarge icon sizes on buttons & tabs for accessibility.
4. **Admin tabs & sections:** adjust tab pill sizing, ensure tab content containers retain visibility (no overflow hidden), and add vertical spacing so “Releases / Reports / Payouts” cards remain fully visible on mobile.

## 3. Data Density & Table Experience
1. Create responsive table helpers: on <=768px collapse into card-like rows, use accordions/details for less-critical columns, and add horizontal scroll gradients for medium viewports.
2. Re-layout parser control buttons so labels never wrap inconsistently; use flex-wrap with defined min widths or stack controls on very small widths.
3. Review “История изменений”, payouts, and reports lists to ensure badges align, text never exceeds one line unless wrapped intentionally, and icons are resized to match typography scale.

## 4. Visual Polish & Consistency Pass
1. Normalize typography scale tokens (heading sizes, breadcrumb text, button labels) and update CSS variables so mobile/Desktop share coherent rhythm.
2. Audit all icon components: enforce minimum tap target (44px) and update SVG sizing classes.
3. Verify dark-theme contrast ratios after spacing tweaks, adjust gradients/backgrounds if needed, and run through smoke test flows (login, artist edit, reports, payouts) to confirm no regressions.

## 5. Validation & Handoff
1. Cross-test on Chrome dev tools + at least one physical mobile device screenshot to confirm fixes.
2. Update screenshots in documentation/README if necessary and summarize remaining edge cases (if any) for follow-up.
