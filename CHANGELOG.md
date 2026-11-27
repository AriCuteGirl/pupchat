# Changelog

## Unreleased

- Launcher entries (AppImage, Flatpak, Nix) start PupChat normally instead of hidden;
  only launch at login starts it hidden

## 0.1.0 — 2026-11-27

First release.

**Chats**
- WhatsApp, Instagram, Discord, Messenger and Telegram web apps in one panel, each in its own
  persistent session; lazy-loaded; logins survive restarts (pages close properly on quit)
- Pinned chats like Equicord's PinDMs, inside PupChat: one list for all platforms, colored
  collapsible categories, avatars and names from the chat header, platform badges; a click
  jumps to that chat on its platform
- Unread badges from page titles (Discord counts only DMs and mentions)

**Look**
- Liquid-glass panel docked left or right, resizable, collapsible list, per-platform zoom
- Optional iMessage look per platform: see-through glass chats with a Chat glass slider,
  your own bubble colors (global or per platform), pill inputs, round send buttons, Inter font
- Discord: import your Equicord / Vencord themes (CSS only)

**Notifications**
- iMessage-style banners at the top center of your screen, tinted in the platform's color,
  with the sender's avatar; click to open the chat; your own banner sound
- Banners also when a site only raises its count (Instagram: newest chat's avatar)
- Game mode: no banners or sounds while hidden, badges keep counting

**Gaming**
- Hyprland: special workspace on `Super + \`, instant show/hide, focus handed back, no cursor jumps
- The paw: glass edge button with unread count, follows the monitor you click into; with
  Quickshell it's an overlay layer that stays visible over fullscreen games
- Hide on blur, sleep unused platforms, per-platform mute and mic/camera, tray icon
- Windows: global shortcut, acrylic on Windows 11, always on top

**Install**
- AppImage, Flatpak, Windows installer, Arch PKGBUILD, local install script, Nix flake
- Launch at login, CLI: `--toggle`, `--show`, `--hide`, `--settings`, `--quit`, `--service=<id>`
