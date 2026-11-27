#!/usr/bin/env bash
# Install PupChat for the current user (no sudo): app in ~/.local/share/pupchat,
# `pupchat` in ~/.local/bin, launcher entry and icons in ~/.local/share.
# Run from the repo: ./scripts/install-local.sh   (uninstall: ./scripts/install-local.sh --uninstall)
set -euo pipefail
cd "$(dirname "$0")/.."

APP_DIR="$HOME/.local/share/pupchat"
BIN="$HOME/.local/bin/pupchat"
DESKTOP="$HOME/.local/share/applications/pupchat.desktop"
ICONS="$HOME/.local/share/icons/hicolor"

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "$BIN" "$DESKTOP"
  for s in 16 24 32 48 64 128 256 512; do rm -f "$ICONS/${s}x${s}/apps/pupchat.png"; done
  [[ -d "$APP_DIR" && -f "$APP_DIR/pupchat" ]] && rm -r "$APP_DIR"
  echo "PupChat removed (your settings and logins in ~/.config/PupChat are kept)."
  exit 0
fi

pnpm install --frozen-lockfile
pnpm exec electron-vite build
pnpm exec electron-builder --linux dir

# Replace the previous install (only our own folder).
if [[ -d "$APP_DIR" ]]; then
  [[ -f "$APP_DIR/pupchat" ]] || { echo "$APP_DIR exists but isn't a PupChat install; stopping." >&2; exit 1; }
  rm -r "$APP_DIR"
fi
mkdir -p "$(dirname "$APP_DIR")"
cp -r dist/linux-unpacked "$APP_DIR"

mkdir -p "$(dirname "$BIN")"
ln -sf "$APP_DIR/pupchat" "$BIN"

for s in 16 24 32 48 64 128 256 512; do
  install -Dm644 "resources/icon/$s.png" "$ICONS/${s}x${s}/apps/pupchat.png"
done

install -Dm644 /dev/stdin "$DESKTOP" <<DESK
[Desktop Entry]
Type=Application
Name=PupChat
GenericName=Chat overlay
Comment=WhatsApp, Instagram, Discord, Messenger and Telegram in one glass panel
Exec=$APP_DIR/pupchat %U
Icon=pupchat
Terminal=false
StartupWMClass=pupchat
Categories=Network;Chat;InstantMessaging;
Keywords=chat;messages;overlay;whatsapp;discord;telegram;instagram;messenger;
DESK

update-desktop-database "$(dirname "$DESKTOP")" 2>/dev/null || true
gtk-update-icon-cache -q "$ICONS" 2>/dev/null || true
echo "PupChat installed: $APP_DIR (run: pupchat)"
