<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Deploy a producción (Firebase Hosting + Cloud Functions SSR)

- **SIEMPRE correr `patch-firebase-tools.ps1` tras `npm install`** y antes de desplegar: re-aplica el parche `next build --webpack` en `node_modules/firebase-tools/lib/frameworks/next/index.js` (Turbopack genera symlinks absolutos que rompen el SSR en GCP).
- Deploy exige elevación (UAC): `deploy-elevated.ps1` (node v22.22.3 de fnm, `CI=true`, `FUNCTIONS_DISCOVERY_TIMEOUT=60`, credenciales de servicio). ~15 min. Log en `deploy.log`. Procesos colgados: `kill-deploy.ps1`.
- `firebase deploy` (webframeworks) inyecta **`.env`** como env de la función SSR; el bundle lee `DB_DRIVER`/`STORAGE_DRIVER`/etc. en **runtime** (Next NO carga `.env.production` en la función). Los valores de producción van en `.env`; local usa `.env.development` (sqlite) vía `next dev`/scripts `db:*`.
- firebase deploy rechaza env vars con prefijos reservados (`X_GOOGLE_ FIREBASE_ EXT_ KIT_`) → la bucket se llama `STORAGE_BUCKET`, no `FIREBASE_STORAGE_BUCKET`.

## Sesión y cookies en producción

- **Firebase Hosting descarta TODAS las cookies de entrada a la función excepto `__session`** (solo esa se reenvía). La cookie de sesión DEBE llamarse `__session` (ver `src/server/auth/dal.ts`, env `SESSION_COOKIE`). `TEMA_COOKIE` (`carto_tema`) tampoco persiste vía Hosting (cosmético).
- Verificación E2E de sesión: `C:\Users\amontoya\AppData\Local\Temp\opencode\login-test.js` (login multipart + GET rutas protegidas). Pruebas de login: si aparece rate-limit, borrar `login_attempts` de admin@carto.com en Firestore.
