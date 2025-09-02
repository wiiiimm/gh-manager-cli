#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob

SRC_DIR="docs/assets"
SVGS=("$SRC_DIR"/*.svg)

if [[ ${#SVGS[@]} -eq 0 ]]; then
  echo "No SVGs found under $SRC_DIR" >&2
  exit 0
fi

to_png_rsvg() {
  local in="$1" out="$2"
  rsvg-convert -o "$out" "$in"
}

to_png_inkscape() {
  local in="$1" out="$2"
  inkscape "$in" --export-type=png --export-filename="$out"
}

to_png_imagemagick() {
  local in="$1" out="$2"
  if command -v magick >/dev/null 2>&1; then
    magick convert "$in" "$out"
  else
    convert "$in" "$out"
  fi
}

convert_one() {
  local in="$1"
  local out="${in%.svg}.png"
  echo "Converting: $in -> $out" >&2
  if command -v rsvg-convert >/dev/null 2>&1; then
    to_png_rsvg "$in" "$out"
  elif command -v inkscape >/dev/null 2>&1; then
    to_png_inkscape "$in" "$out"
  elif command -v magick >/dev/null 2>&1 || command -v convert >/dev/null 2>&1; then
    to_png_imagemagick "$in" "$out"
  else
    echo "Error: No SVG converter found (rsvg-convert, inkscape, or ImageMagick)." >&2
    echo "Install one, e.g.: brew install librsvg   # macOS" >&2
    exit 1
  fi
}

for svg in "${SVGS[@]}"; do
  convert_one "$svg"
done

echo "Done." >&2

