# Frostbound Outpost

Portrait mobile-first 3D stack-carry survival base-builder set in a snowy low-poly wilderness.

- **3D Engine (`web_game/`):** Vite + TypeScript + Three.js (procedural low-poly art, `InstancedMesh`, object pooling, WebAudio SFX)
- **Android Shell (`lib/`, `android/`):** Flutter wrapper with offline embedded asset server, native haptic feedback bridge, and custom Frostbound Outpost launcher icon
- **Releases:** Automated Android APK builds via GitHub Actions on GitHub Releases (no local APK builds required)
