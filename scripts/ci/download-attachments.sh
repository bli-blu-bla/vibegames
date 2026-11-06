#!/usr/bin/env bash
# Lädt Issue-Anhänge herunter, prüft Typ und Größe, scannt mit ClamAV.
# Aufruf: download-attachments.sh <liste.txt> <zielordner>
set -euo pipefail
list="$1"
dest="$2"
max_bytes=$((5 * 1024 * 1024))
tmp="$(mktemp -d)"

[ -s "$list" ] || { echo "Keine Anhänge."; exit 0; }

i=0
while IFS= read -r url; do
  [ -n "$url" ] || continue
  i=$((i + 1))
  out="$tmp/download-$i"
  curl -fsSL --max-filesize "$max_bytes" -H "Authorization: Bearer $GH_TOKEN" -o "$out" "$url"
  mime="$(file -b --mime-type "$out")"
  case "$mime" in
    image/png) ext=png ;;
    image/jpeg) ext=jpg ;;
    image/webp) ext=webp ;;
    image/gif) ext=gif ;;
    audio/ogg) ext=ogg ;;
    audio/mpeg) ext=mp3 ;;
    audio/x-wav | audio/wav) ext=wav ;;
    *) echo "Abgelehnt: $url ($mime). Erlaubt sind PNG, JPG, WebP, GIF, OGG, MP3, WAV."; exit 1 ;;
  esac
  name="$(basename "${url%%\?*}")"
  name="$(echo "${name%.*}" | tr 'A-Z' 'a-z' | tr -cs 'a-z0-9' '-' | sed 's/^-*//;s/-*$//')"
  mv "$out" "$tmp/${name:-asset-$i}.$ext"
done < "$list"

echo "Virenscan..."
if ! clamscan --recursive --infected --no-summary "$tmp"; then
  echo "ClamAV hat etwas gefunden oder ist fehlgeschlagen. Abbruch."
  exit 1
fi

mkdir -p "$dest"
mv "$tmp"/*.* "$dest"/
ls -la "$dest"
