Branding Guidelines
===================

This repository includes a minimal logo system for gh-manager-cli inspired by a terminal UI. The logo avoids GitHub trademarks (e.g., Octocat) and uses generic symbols (prompt caret, star, fork) to convey context.

Assets
- docs/assets/logo-mark.svg — Square mark suitable for icons, badges, avatars.
- docs/assets/logo-horizontal.svg — Mark + wordmark, better for README hero or press.

Color Palette
- Background (tile): #0D1117 (near-black)
- Border/Stroke: #1F2937 (slate-700)
- Accent (prompt/caret): #22D3EE (cyan-400)
- Highlight (star): #FACC15 (amber-300)
- Neutral (fork lines): #A3A3A3 (zinc-400)

Usage
- Prefer the mark (logo-mark.svg) at small sizes (< 96 px). The horizontal wordmark scales well above 320 px wide.
- Place the mark on a dark or neutral background for best contrast. The logo-mark includes a dark tile for consistent appearance.
- Maintain at least 12 px padding around the mark. Do not crop off the rounded corners or traffic-light circles.
- Do not rotate or skew the logo. Color changes should only be made to improve contrast on extreme backgrounds.

Accessibility
- Both SVGs include <title> and <desc> for screen readers.
- Avoid relying on color alone to indicate meaning.

Notes
- The wordmark in logo-horizontal.svg uses system fonts. If you need a static outline-only version (no font dependency), consider exporting to paths from a design tool or request a path-based variant.

