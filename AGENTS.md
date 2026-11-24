This is an Expo/React Native mobile application (monorepo: `apps/mobile`, `packages/domain`, `supabase/`). Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Project rules (Personal Evolution RPG)

- UI text is in Brazilian Portuguese.
- Business rules (XP, levels, streak, schedule) live in `packages/domain` as pure TypeScript with Jest tests. Never duplicate them in screens.
- XP is written only by the database functions `log_habit` / `undo_habit_log`. The app and the AI never insert into `xp_transactions`.
- Every table with personal data has RLS. Any migration change must keep `supabase/sql-tests/10_rls_and_xp.test.sql` passing; add a test for new rules.
- Run `npm run check` from the repo root before declaring a task done.
- Every update shipped to users (new build or EAS Update) with user-visible changes must add an entry at the top of `RELEASE_NOTES` in `packages/domain/src/whatsNew.ts` (next `version`, short items in Portuguese, optional `route`). The app shows it as a "Novidades" tour.
- Every new user-facing feature ships behind a feature flag the team manages in Supabase:
  - a row `feature_<name>` in `public.app_settings`, inserted by the feature's migration with value `0` (off; `1` = on);
  - the key registered in `FEATURES` (`packages/domain/src/features.ts`) and read in the app with `useFeature`;
  - when off, the app hides the feature's UI, and every RPC that writes for it raises `PR050` (see `save_mood_entry`), with a SQL test for both states;
  - its "Novidades" items carry `flag: 'feature_<name>'`.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `apps/mobile/src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
