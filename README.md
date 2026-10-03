# Study Instrument (Return)

A quiet desktop study instrument built around one job: reduce the distance between deciding to study and actually studying.

The app is intentionally narrow. It is not a study-management operating system, notes database, productivity score, calendar, or AI coach.

## Product philosophy

> If a feature makes studying easier, keep it. If a feature makes organizing studying more complicated, remove it.

The current implementation follows the V1 roadmap from the product specification:

- **Focus** — the dominant screen, with a large timer and a subject commitment
- **Tasks** — a deliberately flat list for today's work
- **History** — raw session records and hours, without productivity scoring
- **Settings** — daily minimum, session defaults, reminder times, nag level, and interface sounds

V2 and V3 are intentionally not included yet. The goal is to use V1 long enough to generate real personal behavior data before adding memory, library, or presence-detection features.

---

## Tech stack

- React + TypeScript, built with Vite
- Tailwind CSS
- Electron for the desktop shell
- Routing with `wouter` using hash routing, so the built app works when loaded from a file
- Data stored in the app's `localStorage`

---

## Running the app

### Development (Electron + hot reload)

```bash
npm run electron:dev
```

This starts Vite on port 3000 and opens Electron pointed at it. Changes to `client/` reload automatically. Changes to `electron/main.cjs`, `electron/preload.cjs` or `vite.config.ts` need a full restart.

### Preview the built app

```bash
npm run electron:preview
```

This runs `vite build` and opens Electron on the built files in `dist/public`. Use this to check what the production version looks like.

### Run the existing build without rebuilding

```bash
npm run electron:run
```

This needs an `electron:run` script in `package.json`: `"electron:run": "electron electron/main.cjs"`. It starts from the last build in `dist/`, so run `electron:preview` again after code changes.

### Browser only

```bash
npm run dev
```

Opens the app in a browser. Electron-only features (tray, window controls, main-process notifications) do nothing there.

### Type checking

```bash
npm run check
```

### Packaging an installer

```bash
npm run electron:build
```

Not set up as a regular workflow yet. Output goes to `release/`.

---

## Project structure

```text
client/
  index.html
  src/
    pages/Home.tsx        Main screen: Focus, Tasks, History, Settings
    lib/sounds.ts         Click, completion song, notification and startup sounds
    lib/assets/           Audio files
    App.tsx               Router (hash routing)
    main.tsx              Entry point
    index.css             Styles
electron/
  main.cjs                Window, tray, notifications, window controls
  preload.cjs             Safe bridge between the app and Electron
  icon.png                Tray icon (required)
server/                   Unused static server from the original template
shared/
```

---

## V1 scope

### Focus / Home

- Start a session with a subject and duration
- Large live elapsed timer
- Estimated finish time shown during a session
- Pause and resume a session
- **Automatic completion:** when the elapsed time reaches the planned duration, the session is saved at exactly the planned length, the completion song starts, and a "Stop music" banner appears
- **Manual finish:** Finish session saves the elapsed time with no song
- Show today's accumulated focused time against the daily minimum
- Show this week's focused time against the weekly goal
- Show the current streak based on the daily minimum rule
- Show the next tasks without turning Home into a task-management dashboard

### Tasks

- Add a flat task
- Add an optional subject label
- Mark a task complete or incomplete
- Delete a task
- Keep task state in local storage

### History

- Show recent sessions with subject, date, start time, and duration
- Show focused hours for the current week
- Show a simple Monday–Sunday weekly bar view
- Show average session, number of sessions, and longest session
- Keep the data factual; there is no productivity percentage or score

### Sounds

- **Button clicks:** a click sound on every button, controlled by the **Interface sounds** toggle in Settings (off by default)
- **Completion song:** plays automatically when a session reaches its planned time. It loops until you press **Stop music** or start a new session. It ignores the Interface sounds toggle
- **Notification sound:** plays once when a reminder fires. It ignores the toggle
- **Startup sound:** plays once when the app launches. It ignores the toggle
- Audio files live in `client/src/lib/assets/` and are imported in `client/src/lib/sounds.ts`

### Window and tray (Electron)

- Frameless window with its own top bar. The three circles in the top-right minimize, maximize or restore, and close the window
- Dragging the top bar moves the window
- **Closing the window hides it to the system tray** instead of quitting, so reminders keep firing
- Click the tray icon to reopen the window. Right-click it and choose **Quit** to close the app completely
- Only one instance can run at a time, so reminders never fire twice

### Nagging / reminders

- Configure the daily minimum
- Configure the first reminder time
- Configure the second streak-protection reminder time
- Choose gentle, medium, or aggressive nag level
- Reminders are sent through Electron's main process, so no permission prompt is needed in the desktop app (browsers still ask)
- Reminders fire while the app is running, including while hidden in the tray
- Reminders are skipped after the daily minimum has been reached

### Settings

- Daily minimum, default: 30 minutes
- Default session length, default: 60 minutes
- Weekly goal, default: 25 hours
- First reminder, default: 19:30
- Second reminder, default: 21:30
- Nag level, default: medium
- Interface sounds, default: off

### Explicitly excluded from V1

- Flashcards / Memory
- Library resources
- Focus Presence detection
- Webcam or eye tracking
- Adaptive behavior analysis
- Calendar or semester planning
- Notes editor or knowledge graph
- Gamification, XP, confetti, or productivity scores

---

## Data correctness notes

- Session dates are stored as local `YYYY-MM-DD` keys so daily and weekly totals are calculated from real dates.
- The streak is calculated from the sum of all qualifying sessions on each day, rather than from any single session.
- History bars are generated from actual sessions instead of demo values.
- Previous seeded demo data is migrated out of local storage when detected.
- Sessions shorter than 10 seconds are not logged.
- Task and session state is stored locally. Clearing the app's data or uninstalling it removes your history and streak.

---

## Known limits

- **Reminders need the app running.** They work while the window is hidden in the tray. They do not fire if you chose Quit, if the computer is asleep or off, or if the app was never started. Starting the app automatically at login needs a startup shortcut (see below) or a packaged build.
- **The streak shows 0 until you reach the daily minimum today**, even if you had a long streak up to yesterday.
- **The "30m / day" text on the Focus streak card is fixed** and does not follow the daily minimum setting.
- **No backup.** Data lives in local storage only. An export/import option is a good first step before any backend.
- **Audio autoplay.** The startup sound relies on Electron's `autoplayPolicy` setting. In a plain browser it is usually blocked until the first click.

### Optional: start Return at Windows login

1. Run `npm run electron:preview` once to create a build.
2. Press **Win+R**, type `shell:startup`, and create `return.bat` there:

```bat
@echo off
cd /d D:\studyapp
start "" /min cmd /c npm run electron:run
```

Re-run `npm run electron:preview` after code changes so the startup version stays current.

---

## Manual testing checklist

Use this checklist when making a change.

### Clean state

- [ ] Focus opens with a blank subject field
- [ ] Today shows `0m` for fresh data
- [ ] This week shows `0m` for fresh data
- [ ] Streak shows `0 days` for fresh data
- [ ] Tasks shows no seeded tasks
- [ ] History shows no seeded sessions

### Focus

- [ ] Starting without a subject uses the fallback subject only when the user explicitly starts
- [ ] Starting with a subject shows the subject in the active session
- [ ] The elapsed timer increases once per second
- [ ] Planned duration, percentage and estimated finish time are visible
- [ ] Pause preserves elapsed time, and the finish time shows "paused"
- [ ] Resume continues from the paused elapsed time and shifts the finish time
- [ ] Finish saves a session with no song
- [ ] Finishing a very short session shows the short-session behavior instead of creating misleading history
- [ ] Letting a 1-minute session run out saves it at exactly 1 minute and plays the completion song
- [ ] The song loops, and Stop music or starting a new session stops it

### Sounds

- [ ] With Interface sounds on, every button clicks once
- [ ] With Interface sounds off, buttons are silent
- [ ] The startup sound plays once per launch
- [ ] A reminder plays the notification sound once, and Windows adds no second sound

### Window and tray

- [ ] The three circles minimize, maximize or restore, and hide to the tray
- [ ] The top bar drags the window
- [ ] The tray icon reopens the window
- [ ] Tray → Quit closes the app completely
- [ ] Clicking a reminder brings the window back

### Tasks

- [ ] Add a task with only a title
- [ ] Add a task with a title and subject
- [ ] Press Enter in the title field to add
- [ ] Mark a task complete, then incomplete again
- [ ] Delete a task
- [ ] Restart and confirm tasks persist

### History

- [ ] A completed session appears under Recent sessions
- [ ] The date reads Today or Yesterday when appropriate
- [ ] The duration is formatted correctly
- [ ] Sessions logged, average and longest session update
- [ ] The current week's correct day bar updates
- [ ] Restart and confirm history persists

### Settings and reminders

- [ ] Change daily minimum and confirm Focus reflects it
- [ ] Change default session length and confirm new Focus sessions use it
- [ ] Change weekly goal and confirm Focus and History reflect it
- [ ] Change both reminder times and the nag level
- [ ] Enable reminders and confirm one fires at the set time
- [ ] Confirm reminders do not fire after the daily minimum is reached

### Build

- [ ] `npm run electron:preview` shows the app, not a blank window
- [ ] `npm run check` passes

### Responsive layout

- [ ] Desktop layout keeps the sidebar visible
- [ ] Narrow layout exposes the mobile navigation row
- [ ] Focus setup remains usable at approximately 390px wide
- [ ] Tasks, History, and Settings stack into a single column on narrow screens
- [ ] All controls remain keyboard reachable and visibly focusable

---

## Troubleshooting

- **White window in the preview build:** `vite.config.ts` must have `base: "./"`, and `App.tsx` must use `wouter`'s hash routing. Paths starting with `/` break when loaded from a file.
- **No tray icon:** `electron/icon.png` is missing. Add a small PNG (32×32 or 64×64).
- **Changes to Electron files have no effect:** quit fully (tray → Quit) and restart. `main.cjs` and `preload.cjs` do not hot reload.
- **TypeScript errors on audio imports:** make sure `client/src/vite-env.d.ts` contains `/// <reference types="vite/client" />`.
- **Reminders silent:** enable reminders in Settings, keep today's total below the daily minimum, and make sure the app is running or in the tray.

---

## V2 implementation plan

V2 should be implemented only after V1 has been used for a meaningful period and the session model has proven useful. The goal is to add retrieval and resource keeping without turning the app into a knowledge-management system.

### V2.1 — Library

Add a subject-based shelf for:

- PDFs and books
- Video links
- General links
- Images
- A pointer to a subject's Memory deck

Rules:

- No nested databases
- No backlinks
- No graph view
- No global tagging system
- No Library content on the Focus home screen

Suggested implementation sequence:

1. Introduce a `Subject` record without changing the current Focus mental model.
2. Add `LibraryItem` records containing subject, title, type, URL/file reference, and created date.
3. Add a Library surface behind navigation.
4. Add resource creation and deletion.
5. Verify that existing Tasks, Sessions, and Focus behavior is unchanged.

### V2.2 — Memory / flashcards

Add lightweight retrieval practice:

- Decks grouped by subject
- Cheap Front / Back card creation
- Reveal interaction
- `Knew it` and `Didn't know it` responses
- Simple SM-2-style intervals
- Due-card count by deck

Suggested implementation sequence:

1. Add `Flashcard` with front, back, subject, interval, ease, due date, and review count.
2. Add quick-create card flow with no required metadata beyond front and back.
3. Add the review flow.
4. Add scheduling after each response.
5. Add due counts to Memory only; do not add gamification or scores.
6. Test interval behavior with deterministic date fixtures.

### V2.3 — Session breakdown and weekly bars

The current V1 already records the base session duration. Extend the model only when needed to support:

- Focus duration
- Break duration
- Number of breaks
- Longest break

Then add a factual session breakdown and retain the existing raw History view. Do not convert it into an analytics dashboard.

---

## V3 implementation plan

V3 introduces the Focus Presence state machine only after there is enough real session behavior to validate the thresholds.

### V3.1 — Presence state machine

States:

```text
FOCUS → IDLE → AWAY
  ↑       │      │
  └───────┴──────┘
       activity returns
```

Signals allowed:

- Keyboard activity
- Mouse activity
- Active-window state if the platform integration supports it
- Timer state

Signals explicitly not allowed:

- Webcam
- Eye tracking
- Facial analysis
- Hidden surveillance

Suggested initial thresholds:

- `0–5 min`: no indicator
- `5–15 min`: passive “Inactive for N min” indicator
- `15+ min`: ask “Still studying?”

The system must never unilaterally penalize ambiguous time. The user chooses `I'm still studying` or `Take a break`.

### V3.2 — Event logging

Add an append-only event stream for:

- Session started
- Activity detected
- Idle threshold crossed
- Away threshold crossed
- User confirmed still studying
- User started a break
- Session resumed
- Session finished

Keeping the existing session summary as the user-facing record. Events are the data layer for future analysis, not a new dashboard.

### V3.3 — Unaccounted time

Add factual fields to the session summary:

- Focus time
- Break time
- Idle time
- Away time
- Unaccounted time

Without turning these into a productivity score, the user should be able to see what was recorded and correct ambiguous states.

### V3.4 — Semi-automatic card generation

Only after Memory is stable:

1. Allow the user to paste source material.
2. Generate candidate cards.
3. Show candidates for human approval and editing.
4. Add only approved cards to the deck.
5. Never silently add generated cards.

The human remains the final authority on what is worth remembering.

---

## Data model direction

V1 uses local storage because it is a single-user instrument and the current goal is to validate the behavior before adding infrastructure.

The future logical model is:

```text
Subject
├── Tasks
├── Flashcards
├── Library items
└── Sessions
    ├── subject
    ├── planned_duration
    ├── focused_duration
    ├── break_duration
    ├── number_of_breaks
    ├── longest_break
    ├── start_time
    ├── end_time
    └── interruptions
```

Not adding a database, authentication, or synchronization. Those choices should follow an actual need for backup, multiple devices, or shared access.

---

## Non-goals

The following should remain out of scope unless the product philosophy changes explicitly:

- Calendar and semester planning
- Notes editor or knowledge graph
- Tags, backlinks, and nested databases
- Productivity percentage score
- Webcam or eye tracking
- XP, badges, confetti, or animated fire
- AI tutor or AI productivity-coach persona
- Generic motivational quotes
- Elaborate analytics dashboards

The instrument should remain quiet, factual, and easy to return to.