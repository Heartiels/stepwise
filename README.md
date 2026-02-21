# Stepwise 

Stepwise is an AI-powered mobile app that helps users overcome procrastination by breaking big, overwhelming goals into small, actionable steps — generated in seconds using an LLM.

Built with React Native + Expo as a course project, with a focus on:
- **LLM-powered goal decomposition** via OpenAI GPT
- **Offline-first persistence** — all tasks stored locally with SQLite (`expo-sqlite`)
- **Clean, minimal design** — focused on reducing friction, not adding it

---

## Tech Stack

- React Native (Expo)
- TypeScript
- Expo Router (file-based routing)
- expo-sqlite (local offline database)
- NativeWind v4 (Tailwind CSS for React Native)
- OpenAI API

---

## Requirements

### 1) Install Node.js
- **Node.js LTS is recommended** (more stable than the latest/current version)
- Verify:
  ```bash
  node -v
  npm -v
  ```
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

### 4) Create a `.env` file for AI goal decomposition

* The app supports AI-powered goal decomposition using OpenAI.  
* This is **optional** — if no API key is provided, the app will use **mock data** instead.

* Create a file named `.env` in the **repo root** (same folder as `package.json`):
    ```bash
    EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here

> Notes:
> * The variable name must start with EXPO_PUBLIC_ so Expo can read it in the app.
> * If .env is missing, the app will still run, but AI decomposition will return mock steps.

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


## Project Structure (High-level)


* `app/` — screens & routes (Expo Router, file-based)
  * `(tabs)/` — tab navigator (home / My Goals screen)
  * `task/[id].tsx` — goal detail screen (dynamic route)
  * `_layout.tsx` — root layout (GestureHandlerRootView, DB init)
* `src/` — app logic
  * `db/` — SQLite client, schema, and task repository
  * `services/` — external API integrations (OpenAI)
* `components/` — reusable UI components
  * `ui/` — primitives: Card, Input, Button, etc.
* `hooks/` — custom React hooks
* `constants/` — theme tokens
* `assets/images/` — app icons & splash screen



---
