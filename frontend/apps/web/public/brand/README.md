# ArbiGameFi Brand Assets

## Logo Files

### 1. `logo.svg`

**Primary logo** - Full version with all details

- **Size**: 128x128px viewBox
- **Usage**: Main logo for headers, landing pages, marketing materials
- **Colors**: Product purple (`#8F6CF9`) to casino teal (`#52D4A6`) gradient

### 2. `logo-icon.svg`

**Icon-only version** - Simplified icon mark

- **Size**: 96x96px viewBox
- **Usage**: App icons, social media profile pictures, favicons (larger sizes)
- **Colors**: Brand gradient adapted to the current web palette

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
- **Color**: Product purple (`#8F6CF9`)

### 6. `logo-full.svg`

**Full logo with text** - Icon + "ArbiGameFi" text

- **Size**: 256x96px viewBox
- **Usage**: Official documents, presentations, full branding
- **Colors**: Brand gradient + white text

## Design Specifications

### Brand Colors

- **Primary**: Product purple `#8F6CF9`
- **Primary Dark**: Deep purple `#7A5CF4`
- **Accent**: Casino teal `#52D4A6`
- **Highlight**: Cyan `#6EE7F9`
- **Gradient**: `linear-gradient(120deg, #8F6CF9 0%, #6EE7F9 50%, #52D4A6 100%)`

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
- ✅ No raster fallback generation step; this avoids local `rsvg-convert` hangs and keeps icon output deterministic

## Version History

**v2.0** (June 2026)

- Redesigned for ArbiGameFi's B2C casino/sportsbook product direction
- Adapted the supplied brand shape to the current product palette instead of changing the app's established visual system
- New hexagon-based design concept
- Complete set of variants created

---

**Brand Guidelines**: This file is the active asset-level guideline for the web app.
