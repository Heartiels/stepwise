# Stepwise

Stepwise is an AI-powered mobile productivity app designed to help users overcome procrastination by turning overwhelming goals into small, realistic actions they can start right away.

Built with React Native + Expo as a course project, Stepwise focuses on:
- **Low-friction task starting** with AI-generated micro-steps
- **Offline-first local persistence** using SQLite
- **Execution support** through Today planning, focus sessions, and progress feedback

---

## Current Features

- **Text or voice goal input** - users can type a goal or record it with the in-app microphone button
- **AI-powered goal decomposition** - goals are broken into short, actionable steps in seconds
- **AI step editing** - users can revise selected steps with follow-up AI instructions
- **"I'm stuck" rescue flow** - a difficult step can be re-broken into even smaller actions
- **Start Now focus mode** - users can launch a 5 / 10 / 15 minute focus block directly from a step
- **Focus session tracking** - each step stores focus time and focus session count
- **Today tab** - users can bookmark steps for today's execution
- **Offline goal history** - all goals and subtasks are stored locally with SQLite
- **Goal search** - users can search the history page by goal title
- **Profile dashboard** - includes avatar, nickname, streak, XP, completion heatmap, and focus summary
- **Local AI proxy server** - OpenAI requests are routed through a local Node server instead of exposing the API key in the mobile client

---

## Tech Stack

- React Native (Expo)
- TypeScript
- Expo Router
- expo-av
- expo-file-system
- expo-sqlite
- NativeWind v4
- OpenAI API
- Local Node.js API proxy

---

## Requirements

### 1) Install Node.js

- Node.js LTS is recommended
- Verify:
  ```bash
  node -v
  npm -v
  ```

### 2) Install Git

- Verify:
  ```bash
  git --version
  ```

### 3) Install Expo Go on your phone

- iOS: install **Expo Go** from the App Store
- Android: install **Expo Go** from Google Play

### 4) Create a `.env` file

Create a `.env` file in the repo root:

```bash
OPENAI_API_KEY=your_openai_api_key_here
EXPO_PUBLIC_STEPWISE_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:8787
```

Notes:
- `OPENAI_API_KEY` is used by the local API proxy server
- `EXPO_PUBLIC_STEPWISE_API_BASE_URL` is used by the Expo app to reach that local server
- If the API server is unavailable, goal decomposition falls back to mock data
- Voice transcription and AI step editing require the API server to be running
- If you are testing on a real phone with Expo Go, do **not** use `localhost`; use your computer's LAN IP

### 5) Microphone permission

- The app supports voice goal input
- On first use, iOS / Android will ask for microphone permission
- Voice transcription is currently tuned for English input

---

## Getting Started

### Step 1 - Clone the repo

```bash
git clone https://github.com/Heartiels/stepwise.git
cd stepwise
```

### Step 2 - Install dependencies

```bash
npm install
```

### Step 3 - Start the local AI proxy

```bash
npm run server
```

- The local API server runs on port `8787`
- Keep this terminal open while using AI decomposition, AI editing, or voice transcription

### Step 4 - Start Expo

```bash
npx expo start
```

### Step 5 - Open on your phone

- Connect your phone and computer to the same Wi-Fi
- Open Expo Go
- Scan the QR code shown by Expo

---

## How to Use

### Create a goal

- Open the home screen modal
- Type your goal, or tap the microphone to speak it
- Tap **Break it down!** to generate a step-by-step plan

### Work through a goal

- Open a goal from history
- Swipe a step to mark it done or undo it
- Tap the bookmark icon to add or remove a step from **Today**
- Tap **Start now** to launch a focus session for that step
- If a step feels too difficult, use the stuck flow to break it into smaller actions
- Use **Edit Steps** to revise selected steps with AI

### Focus on today

- Open the **Today** tab
- Review only the steps you marked for today
- Remove a step, start it immediately, or mark it done

### Review progress

- Open **My Goals** to search goal history
- Open **Profile** to view streak, XP, focus minutes, and completion heatmap

---

## Project Structure

- `app/` - screens and routes
  - `(tabs)/index.tsx` - home screen and goal creation modal
  - `(tabs)/today.tsx` - daily execution view
  - `(tabs)/explore.tsx` - profile and stats page
  - `history.tsx` - searchable goal history
  - `task/[id].tsx` - goal detail page and step editing flow
- `components/` - reusable UI pieces
  - `focus-session-sheet.tsx` - reusable focus session modal
  - `step-toast.tsx` - XP / progress toast animation
  - `voice-input-button.tsx` - voice capture trigger
- `src/db/` - SQLite schema, migrations, and repository helpers
- `src/services/` - client-side API helpers for AI and transcription
- `src/tasks/` - step parsing and focus formatting helpers
- `server/` - local Node.js API proxy for OpenAI requests

---

## Recent Updates

- Added **Start Now** focus sessions with 5 / 10 / 15 minute blocks
- Added **focus session tracking** per step and a focus summary on the profile page
- Added **I'm stuck** flow to break one difficult step into smaller actions
- Refactored subtasks into structured fields (`emoji`, `action`, `explanation`) instead of relying only on parsed title text
- Added a **local AI proxy server** so OpenAI requests no longer require exposing the API key in the Expo client
- Integrated partner update for **inline floating XP toast** interactions

---
