# Study Instrument

A quiet, browser-based desktop study instrument built around one job: reduce the distance between deciding to study and actually studying.

The app is intentionally narrow. It is not a study-management operating system, notes database, productivity score, calendar, or AI coach.

## Product philosophy

> If a feature makes studying easier, keep it. If a feature makes organizing studying more complicated, remove it.

The current implementation follows the V1 roadmap from the product specification:

- **Focus** — the dominant screen, with a large timer and a subject commitment
- **Tasks** — a deliberately flat list for today's work
- **History** — raw session records and hours, without productivity scoring
- **Settings** — daily minimum, session defaults, reminder times, and nag level

V2 and V3 are intentionally not included yet. The goal is to use V1 long enough to generate real personal behavior data before adding memory, library, or presence-detection features.

---

## Running the app

This is a WebDev static React app.

### Development

From the project root:

```bash
pnpm dev
```

The WebDev environment also provides a managed preview URL when the project is running.

### Type checking

```bash
pnpm check
```

### Production build

```bash
pnpm build
```

The build runs both the Vite frontend build and the template's server bundle step.

---

## V1 scope

### Focus / Home

- Start a session with a subject and duration
- Large live elapsed timer
- Pause and resume a session
- Finish a session and save it to History
- Show today's accumulated focused time against the daily minimum
- Show this week's focused time against the weekly goal
- Show the current streak based on the daily minimum rule
- Show the next tasks without turning Home into a task-management dashboard

### Tasks

- Add a flat task
- Add an optional subject label
- Mark a task complete or incomplete
- Delete a task
- Keep task state in the browser's local storage

### History

- Show recent sessions with subject, date, start time, and duration
- Show focused hours for the current week
- Show a simple Monday–Sunday weekly bar view
- Show average session, number of sessions, and longest session
- Keep the data factual; there is no productivity percentage or score

### Nagging / reminders

- Configure the daily minimum
- Configure the first reminder time
- Configure the second streak-protection reminder time
- Choose gentle, medium, or aggressive nag level
- Request browser notification permission
- Send reminders while the app is open and notification permission is granted
- Avoid reminders after the daily minimum has been reached

### Settings

- Daily minimum, default: 30 minutes
- Default session length, default: 60 minutes
- Weekly goal, default: 25 hours
- First reminder, default: 19:30
- Second reminder, default: 21:30
- Nag level, default: medium

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

## How V1 was verified

V1 was checked against the V1 roadmap in the product specification, not just against the visual layout.

### Static verification

The following commands pass from the project root:

```bash
pnpm check
pnpm build
```

The TypeScript compiler completes without errors, and the production Vite build completes successfully.

### Browser verification

The live preview was checked at desktop and narrow responsive widths.

The following end-to-end flow was executed:

1. Open the empty Focus screen.
2. Confirm the initial state is personal and blank:
   - `0m` today
   - `0m` this week
   - `0 days` streak
   - no tasks
   - no recent sessions
3. Enter a subject and a short test duration.
4. Start the session.
5. Confirm the live timer appears with the subject and planned goal.
6. Confirm Pause and Finish controls are present.
7. Finish the session.
8. Confirm the session is logged and today's/weekly totals update.
9. Open History.
10. Confirm the subject, date, duration, session count, average session, longest session, and weekly bar update.
11. Remove the temporary test record.
12. Confirm the app returns to the clean personal state.

### Data correctness checks

- Session dates are stored as local `YYYY-MM-DD` keys so daily and weekly totals are calculated from real dates.
- The streak is calculated from the sum of all qualifying sessions on each day, rather than from any single session.
- History bars are generated from actual sessions instead of demo values.
- Previous seeded demo data is migrated out of local storage when detected.
- Task and session state is stored in the current browser only.

### Known V1 boundary

Browser reminders are checked while the app is open. If reminders must fire while the app is completely closed, V2 or a later infrastructure pass should add a service-worker or server-backed notification strategy. This is intentionally not hidden behind a fake “background” guarantee.

---

## Manual testing checklist

Use this checklist when making a frontend change.

### Clean state

- [ ] Focus opens with a blank subject field
- [ ] Today shows `0m` for a fresh browser
- [ ] This week shows `0m` for a fresh browser
- [ ] Streak shows `0 days` for a fresh browser
- [ ] Tasks shows no seeded tasks
- [ ] History shows no seeded sessions

### Focus

- [ ] Starting without a subject uses the safe fallback subject only when the user explicitly starts
- [ ] Starting with a subject shows the subject in the active session
- [ ] The elapsed timer increases once per second
- [ ] Planned duration and percentage are visible
- [ ] Pause preserves elapsed time
- [ ] Resume continues from the paused elapsed time
- [ ] Finish saves a session
- [ ] Finishing a very short test session shows the short-session behavior instead of creating misleading history

### Tasks

- [ ] Add a task with only a title
- [ ] Add a task with a title and subject
- [ ] Press Enter in the title field to add
- [ ] Mark a task complete
- [ ] Mark it incomplete again
- [ ] Delete a task
- [ ] Refresh and confirm tasks persist

### History

- [ ] A completed session appears under Recent sessions
- [ ] The date reads Today or Yesterday when appropriate
- [ ] The duration is formatted correctly
- [ ] Sessions logged increments
- [ ] Average session updates
- [ ] Longest session updates
- [ ] The current week's correct day bar updates
- [ ] Refresh and confirm history persists

### Settings and reminders

- [ ] Change daily minimum and confirm Focus reflects it
- [ ] Change default session length and confirm new Focus sessions use it
- [ ] Change weekly goal and confirm Focus and History reflect it
- [ ] Change both reminder times
- [ ] Change nag level
- [ ] Enable browser reminders and handle permission gracefully
- [ ] Confirm reminders do not fire after the daily minimum is reached

### Responsive layout

- [ ] Desktop layout keeps the sidebar visible
- [ ] Narrow layout exposes the mobile navigation row
- [ ] Focus setup remains usable at approximately 390px wide
- [ ] Tasks, History, and Settings stack into a single column on narrow screens
- [ ] All controls remain keyboard reachable and visibly focusable

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

Keep the existing session summary as the user-facing record. Events are the data layer for future analysis, not a new dashboard.

### V3.3 — Unaccounted time

Add factual fields to the session summary:

- Focus time
- Break time
- Idle time
- Away time
- Unaccounted time

Do not turn these into a productivity score. The user should be able to see what was recorded and correct ambiguous states.

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

V1 uses browser local storage because it is a single-user instrument and the current goal is to validate the behavior before adding infrastructure.

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

Do not add a database, authentication, or synchronization merely because the model can support it. Those choices should follow an actual need for backup, multiple devices, or shared access.

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
