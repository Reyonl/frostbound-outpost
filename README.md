# Frostbound Outpost

Portrait mobile-first 3D stack-carry survival base-builder set in a snowy low-poly wilderness.

- **3D Engine (`web_game/`):** Vite + TypeScript + Three.js (procedural low-poly art, `InstancedMesh`, object pooling, WebAudio SFX)
- **Android Shell (`lib/`, `android/`):** Flutter wrapper with offline embedded asset server, native haptic feedback bridge, and custom Frostbound Outpost launcher icon
- **Releases:** Automated Android APK builds via GitHub Actions on GitHub Releases (no local APK builds required)

---

## Architecture & Roadmap
Detailed design documents, milestone achievements (Phase M1–M6, Phase G1–G4), system architecture diagrams, and quality acceptance criteria can be found in:
👉 [docs/ARCHITECTURE_AND_ROADMAP.md](docs/ARCHITECTURE_AND_ROADMAP.md)

---

## Tech Stack & Verification
- **Web Game:** Three.js 0.175, Vite 6, TypeScript 5.8, Vitest 3
- **Mobile Wrapper:** Flutter 3.x with Android embedding v2
- **Testing:** `npm run test` (Vitest), `npm run typecheck` (`tsc --noEmit`), `flutter analyze lib`
