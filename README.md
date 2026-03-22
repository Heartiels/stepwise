# Stepwise

Stepwise is an AI-powered mobile app that helps users overcome procrastination by breaking big, overwhelming goals into small, actionable steps generated in seconds using an LLM.

Built with React Native + Expo as a course project, with a focus on:
- **LLM-powered goal decomposition** via OpenAI GPT
- **Offline-first persistence** - all tasks stored locally with SQLite (`expo-sqlite`)
- **Clean, minimal design** - focused on reducing friction, not adding it

## Current Features

- **Text or voice goal input** - users can type a goal or record it with the in-app microphone button
- **AI-powered task decomposition** - goals are broken into small, actionable steps in seconds
- **AI step refinement** - users can revise selected steps with follow-up AI editing
- **Today focus view** - users can bookmark specific steps for today and view them in one focused tab
- **Offline goal history** - all goals and subtasks are stored locally with SQLite
- **Goal search** - users can search the My Goals / history page by title
- **Progress tracking** - users can mark steps as done and review their activity over time

---

## Tech Stack

- React Native (Expo)
- TypeScript
- Expo Router (file-based routing)
- expo-av (audio recording)
- expo-file-system (audio upload for transcription)
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

> Windows tip: if `node` / `npm` / `npx` are not found, it usually means Node was not added to PATH. Reinstall Node and enable "Add to PATH".

### 2) Install Git

- Verify:
  ```bash
  git --version
  ```
- If Git is not installed:
  - Windows: install **Git for Windows**
  - macOS: install **Xcode Command Line Tools**
    ```bash
    xcode-select --install
    ```

### 3) Install Expo Go on your phone

- iOS: install **Expo Go** from the App Store
- Android: install **Expo Go** from Google Play
- You will run the app on your phone by scanning a QR code

### 4) Create a `.env` file for AI features

- The app supports AI-powered goal decomposition using OpenAI
- This is **optional** - if no API key is provided, the app will use **mock data** instead

- Create a file named `.env` in the **repo root** (same folder as `package.json`):
  ```bash
  EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
  ```

> Notes:
> - The variable name must start with `EXPO_PUBLIC_` so Expo can read it in the app
> - If `.env` is missing, the app will still run, but AI decomposition will return mock steps
> - Voice transcription also uses the same OpenAI API key

### 5) Microphone permission for voice input

- The app supports voice goal input
- On first use, iOS / Android will ask for microphone permission
- Voice transcription is currently tuned for **English input**
- Tap the microphone once to start recording, then tap again to stop and transcribe

---

## Getting Started (Run the App)

### Step 1 - Clone the repo

```bash
git clone https://github.com/Heartiels/stepwise.git
cd stepwise
```

> IMPORTANT: the **repo root** is the folder that contains `package.json`.
> Make sure you run all commands inside that folder.

### Step 2 - Install dependencies

```bash
npm install
```

### Step 3 - Start the dev server

```bash
npx expo start
```

- You will see a QR code in the terminal

### Step 4 - Open on your phone

- Connect your phone and your computer to the **same Wi-Fi**
- Open **Expo Go**
- Scan the QR code:
  - iOS: use the **Camera** app (or scan inside Expo Go)
  - Android: scan inside Expo Go

> If everything is correct, the app should open within a few seconds.

---

## How to Use

### Create a goal

- Open the home screen modal
- Type your goal manually, or tap the microphone to speak it
- Tap **Break it down!** to generate a step-by-step plan

### Manage a goal

- Open any goal from the history page
- Swipe a step to mark it done or undo it
- Tap the bookmark icon on a step to add or remove it from **Today**
- Use **Edit Steps** to ask AI to revise selected steps

### Focus on today

- Open the **Today** tab
- Review only the steps you marked for today
- Remove a step from Today or mark it done directly from that screen

### Search goal history

- Open **My Goals**
- Use the search bar at the top to filter goals by title in real time

---

## Project Structure (High-level)

- `app/` - screens and routes (Expo Router, file-based)
  - `(tabs)/` - tab navigator (home / today / profile)
  - `(tabs)/today.tsx` - focused list of subtasks marked for today
  - `history.tsx` - goal history screen with search
  - `task/[id].tsx` - goal detail screen (dynamic route)
  - `_layout.tsx` - root layout (`GestureHandlerRootView`, DB init)
- `src/` - app logic
  - `db/` - SQLite client, schema, and task repository
  - `services/` - external API integrations (OpenAI + speech transcription)
- `components/` - reusable UI components
  - `voice-input-button.tsx` - tap-to-record voice input button
  - `ui/` - primitives: Card, Input, Button, etc.
- `hooks/` - custom React hooks
- `constants/` - theme tokens
- `assets/images/` - app icons and splash screen

## Recent Updates

- Added voice goal input with microphone recording and OpenAI transcription
- Added English-focused transcription behavior for voice input
- Added a Today tab for focused daily execution
- Added bookmarking of subtasks into the Today view
- Added search to the My Goals / history screen
- Improved error handling for short recordings and failed transcription responses

---
