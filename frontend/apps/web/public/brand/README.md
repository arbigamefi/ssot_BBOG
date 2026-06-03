# ArbiGameFi Brand Assets

## Logo Files

### 1. `logo.svg`

**Primary logo** - Full version with all details

- **Size**: 128x128px viewBox
- **Usage**: Main logo for headers, landing pages, marketing materials
- **Colors**: Indigo (#6366F1) to Purple (#A855F7) gradient

### 2. `logo-icon.svg`

**Icon-only version** - Simplified icon mark

- **Size**: 96x96px viewBox
- **Usage**: App icons, social media profile pictures, favicons (larger sizes)
- **Colors**: Brand gradient (Indigo to Purple)

### 3. `logo-favicon.svg`

**Favicon version** - Ultra-simplified for small sizes

- **Size**: 32x32px viewBox (scales down to 16x16px)
- **Usage**: Browser favicons, app icons (small sizes)
- **Colors**: Brand gradient

### 4. `logo-favicon-inverse.svg`

**Inverse favicon** - For light backgrounds

- **Size**: 32x32px viewBox
- **Usage**: Favicons on light backgrounds, mobile app icons
- **Colors**: Brand gradient (optimized for light backgrounds)

### 5. `logo-monochrome.svg`

**Monochrome version** - Single color

- **Size**: 96x96px viewBox
- **Usage**: Single-color printing, monochrome displays
- **Color**: Indigo-500 (#6366F1)

### 6. `logo-full.svg`

**Full logo with text** - Icon + "ArbiGameFi" text

- **Size**: 256x96px viewBox
- **Usage**: Official documents, presentations, full branding
- **Colors**: Brand gradient + white text

## Design Specifications

### Brand Colors

- **Primary**: Indigo-500 `#6366F1`
- **Primary Dark**: Indigo-600 `#4F46E5`
- **Accent**: Purple-500 `#A855F7`
- **Gradient**: `linear-gradient(120deg, #6366F1 0%, #818CF8 50%, #A855F7 100%)`

### Design Concept

- **Hexagon**: Represents blockchain structure, fairness, and transparency
- **Inner Geometry**: Represents gaming mechanics and code-based fairness
- **Center Symbol**: "Fair by Code" representation - diamond/crystal shape
- **Corner Accents**: Dynamic elements representing yield and rewards

### Usage Guidelines

#### Minimum Sizes

- **Logo**: 24px minimum height
- **Icon**: 16px minimum
- **Favicon**: 16px minimum

#### Clear Space

- Minimum clear space: 1/4 of logo height on all sides
- Maintain adequate spacing from other elements

#### Don't

- ❌ Distort or rotate arbitrarily
- ❌ Use on busy backgrounds without proper masking
- ❌ Alter brand colors
- ❌ Overlay with low-contrast colors
- ❌ Use logo-icon.svg as favicon (use logo-favicon.svg instead)

## File Locations in Project

```
frontend/apps/web/public/
├── favicon.svg              # Browser favicon, based on logo-favicon.svg
└── brand/                   # Brand assets (this directory)
    ├── arbigamefi-lockup.svg # Compatibility alias for legacy callers
    ├── arbigamefi-mark.svg   # Compatibility alias for legacy callers
    ├── logo.svg              # Primary logo
    ├── logo-icon.svg         # Icon version
    ├── logo-favicon.svg      # Favicon version
    ├── logo-favicon-inverse.svg
    ├── logo-monochrome.svg
    └── logo-full.svg         # Full logo with text
```

## Implementation Notes

All logos are SVG format for:

- ✅ Scalability at any size
- ✅ Small file sizes
- ✅ Perfect quality at all resolutions
- ✅ Easy color customization via CSS

## Version History

**v2.0** (June 2026)

- Redesigned for ArbiGameFi's B2C casino/sportsbook product direction
- Updated colors to match brand palette (Indigo/Purple)
- New hexagon-based design concept
- Complete set of variants created

---

**Brand Guidelines**: This file is the active asset-level guideline for the web app.
