# Design System Specification: Editorial Softness & Digital Fluidity

## 1. Overview & Creative North Star: "The Ethereal Curator"
This design system moves away from the rigid, boxy constraints of traditional SaaS dashboards. Our Creative North Star is **"The Ethereal Curator."** We are not just building a scheduling tool; we are creating a high-end gallery space for digital content. 

To achieve this, the system prioritizes **Atmospheric Depth** over structural lines. By utilizing intentional asymmetry, overlapping glass surfaces, and a sophisticated typographic scale, we transform a functional utility into a premium editorial experience. We replace "interfaces" with "environments" where content breathes through generous white space and soft, tonal transitions.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a sophisticated interpretation of social aesthetics—moving beyond basic pinks into a spectrum of deep orchid (`primary`) and soft lavender (`secondary`).

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. Layout boundaries must be established exclusively through background shifts. 
- Use `surface` (#f5f6f7) for the global canvas.
- Use `surface_container_low` (#eff1f2) for secondary sidebars.
- Use `surface_container_lowest` (#ffffff) for primary content cards to create a "lifted" feel without a stroke.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-translucent materials. 
*   **Level 0 (Base):** `surface`
*   **Level 1 (Sections):** `surface_container`
*   **Level 2 (Active Cards):** `surface_container_lowest`
*   **Level 3 (Popovers/Modals):** Glassmorphism (see below).

### The "Glass & Gradient" Rule
For floating elements like navigation bars or hover-state tooltips, use **Backdrop Blur (20px - 32px)** combined with a 70% opacity version of `surface_container_lowest`. 
*   **Signature Texture:** Main Action Buttons must use a linear gradient from `primary` (#a91f71) to `primary_container` (#ff6bb8) at a 135-degree angle. This injects "soul" into the UI, preventing the flat, "template" look.

---

## 3. Typography: Editorial Authority
We pair **Plus Jakarta Sans** (Display/Headlines) with **Inter** (Body/UI) to balance personality with high-utility legibility.

- **Display & Headlines:** Use `display-md` and `headline-lg` with a tight tracking (-2%) to create an authoritative, magazine-like header style. 
- **The Contrast Play:** Use `on_surface_variant` (#595c5d) for `body-md` descriptions to create a soft hierarchy against the high-contrast `on_surface` (#2c2f30) titles.
- **Labels:** `label-sm` should always be in All Caps with +5% letter spacing to distinguish functional metadata from narrative content.

---

## 4. Elevation & Depth
Traditional drop shadows are forbidden. We use **Tonal Layering** and **Ambient Light.**

- **The Layering Principle:** Place a `surface_container_lowest` card on a `surface_container` background. The 2-unit hex difference provides all the "border" a modern eye needs.
- **Ambient Shadows:** For high-level modals, use a multi-layered shadow:
    - `0px 4px 20px rgba(169, 31, 113, 0.04)` (A hint of the Primary tint)
    - `0px 12px 40px rgba(0, 0, 0, 0.03)`
- **The "Ghost Border" Fallback:** If accessibility requires a container edge (e.g., in high-glare environments), use the `outline_variant` (#abadae) at **15% opacity**.

---

## 5. Components

### Buttons & Interaction
- **Primary:** Gradient (`primary` to `primary_container`), `xl` (1.5rem) roundedness. No border.
- **Secondary:** Surface-tinted. Use `secondary_container` (#eac4ff) with `on_secondary_container` (#6a1d9b) text.
- **Micro-interaction:** On hover, buttons should scale to 102% with a `0.4s` cubic-bezier(0.34, 1.56, 0.64, 1) transition.

### Cards & Feed Items
- **Constraint:** Zero borders. Zero dividers. 
- **Separation:** Use `spacing.8` (2rem) of vertical white space to separate feed items. 
- **Nesting:** Place a `label-md` "Status" chip inside the card using `surface_variant` to create a "recessed" look.

### Input Fields
- **Default State:** `surface_container_high` background, `none` border.
- **Focus State:** Subtle `primary` ghost-border (20% opacity) and a slight internal glow.
- **Rounding:** Use `md` (0.75rem) to maintain a soft but professional geometry.

### Scheduling Chips
- Use `primary_fixed_dim` for "Scheduled" states and `secondary_fixed_dim` for "Draft" states. These softer tones prevent the dashboard from feeling "noisy" when filled with data.

---

## 6. Do's and Don'ts

### Do
- **Do** use `24` (6rem) spacing for top-level page margins to let the editorial typography breathe.
- **Do** overlap elements. A floating glass navigation bar should slightly overlap the header content to create depth.
- **Do** use "Soft Clips." Images and thumbnails should use `lg` (1rem) rounded corners to match the friendly SaaS aesthetic.

### Don't
- **Don't** use pure black (#000000) for text. Always use `on_surface` (#2c2f30) to keep the contrast "soft-pro."
- **Don't** use 1px dividers to separate list items. Use a `surface_container_low` background strip on hover instead.
- **Don't** use standard "Drop Shadows." If it looks like a shadow from 2015, it's too heavy. If you can't tell if there's a shadow or just a background shift, it's perfect.