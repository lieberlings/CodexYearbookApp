# Codex Project Setup

## Repository Root

Use this folder as the Codex project root:

```text
C:\Users\Lieber\Documents\YearBookApp\CodexYearbookApp
```

## Current Project Shape

- React Native + Expo app.
- Android-first target.
- Native Android project lives in `android`.
- Shared Codex project guidance lives in `AGENTS.md`.

## Verified Commands

Run these from the repository root unless noted otherwise.

```powershell
npm exec tsc -- --noEmit
npm run lint
npm test -- --runInBand
```

Run this from `android`:

```powershell
.\gradlew.bat :app:compileDebugKotlin --console=plain --no-daemon
```

The full Jest suite currently takes about 90 seconds on this machine.

## Recommended Codex App Actions

Configure these in the Codex app project settings under local environments/actions.

| Name | Working directory | Command |
| --- | --- | --- |
| Start Expo | repo root | `npm run start` |
| Android | repo root | `npm run android` |
| Type Check | repo root | `npm exec tsc -- --noEmit` |
| Lint | repo root | `npm run lint` |
| Test | repo root | `npm test -- --runInBand` |
| Android Kotlin Compile | `android` | `.\gradlew.bat :app:compileDebugKotlin --console=plain --no-daemon` |

## Recommended Setup Script

For new Codex worktrees, use this setup step:

```powershell
npm install
```

Do not put local secrets, signing keys, keystores, or machine-specific Android SDK paths into setup scripts.

## Tooling Roles

- Use Android Studio for emulator/device management, SDK tooling, profiling, and visual native debugging.
- Use VS Code or Codex for normal source editing.
- Use Codex for repo-wide changes, refactors, tests, reviews, and command-line build/debug work.
