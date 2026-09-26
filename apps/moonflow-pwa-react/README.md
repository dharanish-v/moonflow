# Moonflow app

The whole product lives here: a React 19 + TypeScript PWA. See the root `README.md` for install instructions and features, and `../../docs/` for the design and decision records.

## Stack

- **App:** Vite 8, React 19, TypeScript (strict), TanStack Router (hash history, lazy route components).
- **UI:** Tailwind v4 with shadcn/ui (Radix, vaul), themed with Moonflow's own navy/gold tokens (`src/index.css`); Framer Motion honours reduced motion.
- **Data:** Dexie over IndexedDB, holding a real database and a separate decoy database (duress PIN).
- **Offline:** vite-plugin-pwa (`generateSW`) precaches every chunk.
- **Tests:** Vitest, Testing Library, jest-axe and fake-indexeddb. Build guards in `build/*.test.ts` check contrast, CSP, Dynamic Type, iOS polish and code splitting.

## Layout

```
src/lib/        pure logic: forecast, health nudges, symptom timing, crypto, import/export, ics, csv
src/state/      store (Context + reducer), useSaveSettings (write-then-dispatch)
src/router/     routes, AppGate (boot / lock / onboarding gate), placeholders
src/screens/    one file per screen
src/components/ shared UI (PinEntryForm, ExportSheet, ImportBackup, RemindersSheet, UndoToast, ui/*)
build/          build-time CSP plugin + static guard tests
```

## Commands

```bash
npm run dev | npm test | npm run lint | npx tsc -b | npm run build | npm run preview
```
