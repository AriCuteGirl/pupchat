# PupChat on NixOS

Run it once:

```bash
nix run github:AriCuteGirl/pupchat
```

Or add it to your system (flake-based NixOS config):

```nix
# flake.nix inputs
pupchat.url = "github:AriCuteGirl/pupchat";

# configuration.nix
environment.systemPackages = [ inputs.pupchat.packages.x86_64-linux.default ];
```

On Hyprland, add the keybind and window rules from the main README.
