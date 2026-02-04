# Stepwise (Offline-first Task Splitter)

Stepwise is an offline-first mobile app (React Native + Expo) that helps users break big goals into small actionable steps and execute them step-by-step.

This repo is built for a course project and focuses on:
- Simple task list
- Offline local storage (SQLite)
- Clean, minimal UX
- Easy setup for teammates on Windows/macOS

---

## Tech Stack

- React Native (Expo)
- TypeScript
- Expo Router (file-based routing)
- expo-sqlite (local offline database)

---

## Requirements

### 1) Install Node.js
- **Node.js LTS is recommended** (more stable than the latest/current version)
- Verify:
  ```bash
  node -v
  npm -v
- Windows tip: if node/npm/npx not found, it usually means Node was not added to PATH. Reinstall Node and enable “Add to PATH”.

### 2) Install Git
- Verify:
  ```bash
  git --version

### 3) Install Expo Go on your phone
- iOS: install Expo Go from the App Store
- Android: install Expo Go from Google Play
You will run the app on your phone by scanning a QR code.

---

## Getting Started (Run the App)
Step 1 — Clone the repo
git clone https://github.com/Heartiels/stepwise.git
cd stepwise


IMPORTANT: the repo root is the folder that contains package.json.
Make sure you run commands inside that folder.

Step 2 — Install dependencies
npm install

Step 3 — Start the dev server
npx expo start


You will see a QR code in the terminal.

Step 4 — Open on your phone

Connect your phone and your computer to the same Wi-Fi

Open Expo Go

Scan the QR code:

iOS: open Camera app or scan inside Expo Go

Android: scan inside Expo Go

If everything is correct, the app opens within a few seconds.

Network / QR Code Troubleshooting (Very Common)
✅ Best practice checklist

Phone and laptop on the same network (same Wi-Fi)

Turn off VPN / proxy on both phone and laptop

Allow Node/Expo through firewall:

Windows Defender Firewall may block Metro bundler

If campus Wi-Fi blocks LAN discovery, use tunnel mode:

npx expo start --tunnel

“Not found / No usable data / Cannot connect”

Try these in order:

Restart Expo:

npx expo start --clear


Use tunnel:

npx expo start --tunnel


Check firewall (Windows):

Allow Node.js / Expo CLI network access when prompted

If no prompt appears, manually allow Node in firewall settings

Switch network:

If you’re on a restricted/campus network, try phone hotspot

Platform Notes (Windows vs macOS)
✅ Windows + macOS teammates (Git) — any conflict?

No major conflict if we follow these rules:

Always use npm install locally, do not commit node_modules

Avoid OS-specific paths in code

Use consistent line endings (LF) to reduce diff noise

Recommended git setting:

Windows: set Git to keep LF

git config core.autocrlf false
git config core.eol lf


We also recommend adding .gitattributes to enforce LF (already included / should be included).

Local Database (SQLite)

We use expo-sqlite to store tasks locally on the device.

Data is saved on your phone/simulator, not in the repo.

If you reinstall Expo Go or clear app storage, the DB resets.

Common Commands

Start (normal):

npx expo start


Start with clean cache:

npx expo start --clear


Start with tunnel (for strict networks):

npx expo start --tunnel

Project Structure (High-level)

app/ — screens & routes (expo-router)

src/ — app logic (db, helpers, etc.)

src/db/ — SQLite client, schema, repos

assets/ — icons & images

Contributing / Workflow

Suggested branch workflow:

Create a feature branch:

git checkout -b feat/your-feature


Commit and push:

git add .
git commit -m "feat: your feature"
git push -u origin feat/your-feature


Open a Pull Request on GitHub.

FAQ
Q1: I can run the server but the phone can’t open it

Use --tunnel, and make sure both devices are not on VPN.

Q2: Do we need a Mac to develop iOS?

No. With Expo Go, you can run iOS on an iPhone without a Mac.
(But building a standalone App Store build later requires macOS / EAS build.)

Q3: Web build errors with expo-sqlite

This project is primarily mobile (iOS/Android).
If you run web mode, SQLite web worker/wasm may cause bundling issues.
Recommended: focus on Expo Go mobile runtime.

License

MIT
