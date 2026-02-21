# Stepwise (Offline-first Task Splitter)

Stepwise is an offline-first mobile app (React Native + Expo) that helps users break big goals into small actionable steps and execute them step-by-step.

This repo is built for a course project and focuses on:
- Simple task list (create + list tasks)
- Offline local storage (SQLite via `expo-sqlite`)
- Tasks persist on-device (still there after reload / app restart)
- Clean, minimal UX
- Easy setup for teammates on Windows/macOS

---

## Tech Stack

- React Native (Expo)
- TypeScript
- Expo Router (file-based routing)
- expo-sqlite (local offline database)
- OpenAI API (optional, for AI goal decomposition)

---

## Requirements

### 1) Install Node.js
- **Node.js LTS is recommended** (more stable than the latest/current version)
- Verify:
  ```bash
  node -v
  npm -v
> Windows tip: if node/npm/npx not found, it usually means Node was not added to PATH. Reinstall Node and enable “Add to PATH”.

### 2) Install Git

* Verify:

  ```bash
  git --version
  ```
* If Git is not installed:

  * Windows: install **Git for Windows**
  * macOS: install **Xcode Command Line Tools**:

    ```bash
    xcode-select --install
    ```

### 3) Install Expo Go on your phone

* iOS: install **Expo Go** from the App Store
* Android: install **Expo Go** from Google Play
* You will run the app on your phone by scanning a QR code.

### 4) (Optional) Create a `.env` file for AI goal decomposition

The app supports AI-powered goal decomposition using OpenAI.  
This is **optional** — if no API key is provided, the app will use **mock data** instead (so teammates can still run the project).

Create a file named `.env` in the **repo root** (same folder as `package.json`):

```bash
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here

> Notes:
> The variable name must start with EXPO_PUBLIC_ so Expo can read it in the app.
> .env is ignored by Git (not pushed), so each teammate must create it manually.
> If .env is missing, the app will still run, but AI decomposition will return mock steps.

---

## Getting Started (Run the App)

### Step 1 — Clone the repo

```bash
git clone https://github.com/Heartiels/stepwise.git
cd stepwise
```

> IMPORTANT: the **repo root** is the folder that contains `package.json`.
> Make sure you run all commands **inside that folder**.

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Start the dev server

```bash
npx expo start
```

* You will see a QR code in the terminal.

### Step 4 — Open on your phone

* Connect your phone and your computer to the **same Wi-Fi**
* Open **Expo Go**
* Scan the QR code:

  * iOS: use **Camera** app (or scan inside Expo Go)
  * Android: scan inside Expo Go

> If everything is correct, the app should open within a few seconds.

---

## Network / QR Code Troubleshooting (Very Common)

### ✅ Best practice checklist

* Phone and laptop on the **same network** (same Wi-Fi)
* Turn off **VPN / proxy** on both phone and laptop
* Allow Node/Expo through firewall (especially on Windows)

### If campus Wi-Fi blocks LAN discovery: use tunnel mode

```bash
npx expo start --tunnel
```

### “Not found / No usable data / Cannot connect”

Try these in order:

1. Restart Expo with clean cache:

```bash
npx expo start --clear
```

2. Use tunnel:

```bash
npx expo start --tunnel
```

3. Check firewall (Windows):

* If you see a popup asking for permission, click **Allow**
* If no popup appears, manually allow **Node.js** network access in Windows Defender Firewall

4. Switch network:

* If you’re on a restricted/campus network, try **phone hotspot**

---

### “Missing credentials / OPENAI_API_KEY” error

If you see an error like:

> Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.

It usually means the app is trying to use OpenAI but no API key is configured.

Fix:
1. Create a `.env` file in the repo root

2. Add:
   ```bash
   EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here

3. Restart Expo:
    ```bash
    npx expo start --clear

* If you do not want to use OpenAI yet, that is okay — the app now supports a mock fallback and should still run without a key.

---

## Platform Notes (Windows vs macOS)

### ✅ Windows + macOS teammates (Git) — any conflict?

No major conflict if we follow these rules:

* Always run `npm install` locally (**do not commit `node_modules/`**)
* Avoid OS-specific absolute paths in code
* Use consistent line endings (**LF**) to reduce diff noise

### Recommended Git settings (Windows)

Run inside the repo:

```bash
git config core.autocrlf false
git config core.eol lf
```

> Tip: a `.gitattributes` file can enforce LF for the whole repo.

---

## Local Database (SQLite)

We use `expo-sqlite` for offline-first storage.

- The database file is created on the device: `stepwise.db`
- Tables are created on first launch (via our DB init)
- Tasks you add in the Home tab are persisted locally (survive reload / restart)
- If you delete the app / clear Expo Go storage, the local DB will reset
- This repo does **not** sync data to the cloud (offline-only for now)

> Note: Web mode is not a primary target. `expo-sqlite` may cause web bundling issues (wasm/worker).
> Recommended: run on iOS/Android with Expo Go.


---

## Common Commands

* Start (normal):

  ```bash
  npx expo start
  ```

* Start with clean cache:

  ```bash
  npx expo start --clear
  ```

* Start with tunnel (for strict networks):

  ```bash
  npx expo start --tunnel
  ```

---

## Project Structure (High-level)

* `app/` — screens & routes (expo-router)
* `src/` — app logic (db, helpers, etc.)
* `src/db/` — SQLite client, schema, repos
* `assets/` — icons & images

---

## Contributing / Workflow

### Suggested branch workflow

1. Create a feature branch:

```bash
git checkout -b feat/your-feature
```

2. Commit and push:

```bash
git add .
git commit -m "feat: your feature"
git push -u origin feat/your-feature
```

3. Open a Pull Request on GitHub

---

## FAQ

### Q1: I can run the server but the phone can’t open it

* Use `--tunnel`, and make sure both devices are not on VPN.

```bash
npx expo start --tunnel
```

### Q2: Do we need a Mac to develop iOS?

* No. With Expo Go, you can run iOS on an iPhone without a Mac.
* (But building a standalone App Store build later typically needs EAS build / macOS.)

### Q3: Web build errors with expo-sqlite

* This project is primarily mobile (iOS/Android).
* Web mode may fail due to SQLite web worker/wasm bundling.
* Recommended: focus on Expo Go mobile runtime.

### Q4: Do I need an OpenAI API key to run the app?

* No. The app can run without a key.

- With `.env` + `EXPO_PUBLIC_OPENAI_API_KEY`: real AI decomposition (OpenAI)
- Without `.env`: mock decomposition data (for local development / teammates)

* This is intentional so the project can be cloned and run easily without sharing secrets.

---

## License

MIT

---
