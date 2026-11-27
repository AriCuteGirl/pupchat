# Changelog

## 0.1.0 — 2026-11-27

First version.

- WhatsApp, Instagram, Discord, Messenger and Telegram web apps in one panel, each in its own
  persistent session; lazy-loaded; logins survive restarts (pages close properly on quit)
- Liquid-glass panel docked to the left or right screen edge, resizable, collapsible list
- Hyprland: special workspace with `Super + \`, instant show/hide, focus handed back, no cursor jumps
- The paw: glass edge button with unread count, follows the monitor you click into; on Hyprland
  with Quickshell it's an overlay layer that stays visible over fullscreen games
- iMessage-style notification banners at the top center, click to open the chat
- Optional iMessage look per platform: glass chats with a Chat glass slider, bubble colors
  (global or per platform), pill inputs, round send buttons, Inter font where allowed
- Settings: game mode, hide on blur, sleep unused platforms, per-platform banners, mute and
  mic/camera, zoom per platform, launch at login, Windows shortcut
- Tray icon with show/hide, game mode, mute, settings and quit
- Windows: global shortcut, acrylic on Windows 11, always on top
- Discord: import your Equicord/Vencord themes (CSS only; imports inlined, small images embedded)
- CLI: `--toggle`, `--show`, `--hide`, `--settings`, `--quit`, `--service=<id>`
