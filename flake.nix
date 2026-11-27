{
  description = "PupChat: liquid-glass, iMessage-style chat overlay for gaming";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
      version = "0.1.0";
      pupchat = pkgs.appimageTools.wrapType2 rec {
        pname = "pupchat";
        inherit version;
        src = pkgs.fetchurl {
          url = "https://github.com/AriCuteGirl/pupchat/releases/download/v${version}/PupChat-${version}-x86_64.AppImage";
          hash = "sha256-sd0ubd2qL0hUFTphWnL0DP2zBc6akbVhp/NwpE93VQA=";
        };
        extraInstallCommands =
          let contents = pkgs.appimageTools.extractType2 { inherit pname version src; };
          in ''
            install -Dm444 ${contents}/pupchat.desktop $out/share/applications/pupchat.desktop
            substituteInPlace $out/share/applications/pupchat.desktop --replace-fail 'Exec=AppRun' 'Exec=pupchat'
            cp -r ${contents}/usr/share/icons $out/share/ 2>/dev/null || true
          '';
        meta = {
          description = "Liquid-glass, iMessage-style chat overlay for gaming";
          homepage = "https://github.com/AriCuteGirl/pupchat";
          license = pkgs.lib.licenses.mit;
          platforms = [ "x86_64-linux" ];
          mainProgram = "pupchat";
        };
      };
    in {
      packages.${system} = { inherit pupchat; default = pupchat; };
      apps.${system}.default = { type = "app"; program = "${pupchat}/bin/pupchat"; };
    };
}
