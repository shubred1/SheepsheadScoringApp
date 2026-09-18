# PWA and Deployment Notes

GitHub Pages publishes `main`; normal work happens on `dev`. The app is served under `/SheepsheadScoringApp/`, which is reflected in the manifest `start_url`/`scope`, asset links, and service-worker registration.

`manifest.webmanifest` defines the standalone installable app and icons. `sw.js` imports `version.js`, uses `SHEEPSHEAD_APP_VERSION` in the cache name, precaches the app shell (`index.html`, CSS, JavaScript, manifest, version, and icons), claims clients on activation, and uses network-first fetches with cache fallback. Navigation fallback serves cached `index.html` when offline.

Do not bump `version.js` for each development edit. Before preparing a release that includes cacheable app-asset changes, bump it once so the service worker receives a distinct cache. Activation removes old caches, but this affects only cache storage—not localStorage game data.

Game data lives in browser localStorage, so it is specific to that browser and device. Installation/offline use is not cloud sync. Clearing browser/site data can remove saved games. Normal app or service-worker updates should not clear localStorage; only the application's incompatible storage-version recovery path replaces it.

The app tracks the usable viewport in `--app-viewport-height`, using `visualViewport.height` when available and `innerHeight` otherwise. It refreshes at startup, on resize/orientation changes, and after the first layout frames so an installed Android app that reloads after a service-worker update does not retain a stale viewport height.

Native packaging or Capacitor is not currently required. Keep the existing GitHub Pages path assumptions intact unless deployment is intentionally redesigned.
