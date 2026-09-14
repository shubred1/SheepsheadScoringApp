# Sheepshead Scorekeeper

A local-first Sheepshead scoring app for GitHub Pages.

## Installing The App

### Android

Open the app in Chrome while online, then use the browser menu and choose **Install app** or **Add to Home screen** when available.

### iPhone And iPad

Open the app in Safari while online, tap **Share**, then choose **Add to Home Screen**.

## Saved Data And Offline Use

Scores, player names, settings, and theme preference are saved locally on the device/browser with `localStorage`. They are not synced between devices or browsers.

Visit and load the app once while online before relying on offline use. After that first successful load, the app shell is cached so it can open and run without an internet connection.

## Developer Documentation

See [AGENTS.md](AGENTS.md), [current project status](PROJECT_STATUS.md), and the [docs](docs/) folder for architecture, data-model, scoring, product-decision, and PWA notes.
