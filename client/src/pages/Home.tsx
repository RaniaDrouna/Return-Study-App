import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Flame,
  History as HistoryIcon,
  LayoutList,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  Settings2,
  Square,
  TimerReset,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { playClick, startFinishSong, stopFinishSong, playNotification, playStartup } from "@/lib/sounds";

type Section = "focus" | "tasks" | "history" | "settings";
type Task = { id: number; title: string; subject: string; done: boolean };
type Session = { id: number; subject: string; seconds: number; date: string; start: string };
type Settings = { dailyMinimum: number; weeklyGoal: number; defaultDuration: number; reminder: string; secondReminder: string; nagLevel: string; soundEffects: boolean };

const seedTasks: Task[] = [];
const seedSessions: Session[] = [];
const seedSettings: Settings = { dailyMinimum: 30, weeklyGoal: 25, defaultDuration: 60, reminder: "19:30", secondReminder: "21:30", nagLevel: "medium", soundEffects: false };

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`study-instrument:${key}`);
    if (!raw) return fallback;
    const value = JSON.parse(raw) as T;
    if (key === "tasks" && Array.isArray(value) && value.some((item) => ["Semaphore exercises", "Revise continuity", "Finish TD 2", "Read chapter 4 proofs"].includes(item.title))) {
      localStorage.removeItem(`study-instrument:${key}`);
      return fallback;
    }
    if (key === "sessions" && Array.isArray(value) && value.some((item) => [8040, 3720, 6420, 9060].includes(item.seconds))) {
      localStorage.removeItem(`study-instrument:${key}`);
      return fallback;
    }
    return value;
  } catch { return fallback; }
}
function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${hours}:${mins}:${secs}`;
}
function formatShort(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.round((totalSeconds % 3600) / 60);
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}
function todayLabel() {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}
function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function isToday(key: string) { return key === toLocalDateKey(); }
function isThisWeek(key: string) {
  const date = dateFromKey(key);
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return date >= start && date < end;
}
function formatSessionDate(key: string) {
  if (isToday(key)) return "Today";
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (key === toLocalDateKey(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(dateFromKey(key));
}
function calculateCurrentStreak(sessions: Session[], minimumSeconds: number) {
  const secondsByDay = sessions.reduce<Record<string, number>>((totals, session) => ({ ...totals, [session.date]: (totals[session.date] || 0) + session.seconds }), {});
  const qualifyingDays = new Set(Object.entries(secondsByDay).filter(([, seconds]) => seconds >= minimumSeconds).map(([date]) => date));
  let streak = 0;
  const cursor = new Date();
  while (qualifyingDays.has(toLocalDateKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
function getWeekDays(sessions: Session[]) {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    const key = toLocalDateKey(date);
    return { day: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date), value: sessions.filter((session) => session.date === key).reduce((sum, session) => sum + session.seconds, 0) / 3600 };
  });
}

// ELECTRON: notifications go through the main process when running in Electron.
function sendNotification(title: string, body: string) {
  playNotification();
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.isElectron) {
    electronAPI.notify(title, body); // reliable main-process path
  } else if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body }); // browser fallback
  }
}

export default function Home() {
  const [section, setSection] = useState<Section>("focus");
  const [tasks, setTasks] = useState<Task[]>(() => readStore("tasks", seedTasks));
  const [sessions, setSessions] = useState<Session[]>(() => readStore("sessions", seedSessions));
  const [settings, setSettings] = useState<Settings>(() => readStore("settings", seedSettings));
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => readStore("notificationsEnabled", false));
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(() => readStore<Settings>("settings", seedSettings).defaultDuration);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [planned, setPlanned] = useState(3600);
  const [notice, setNotice] = useState("");
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [songPlaying, setSongPlaying] = useState(false);

  const focusedToday = useMemo(() => sessions.filter((session) => isToday(session.date)).reduce((sum, session) => sum + session.seconds, 0) + (active ? elapsed : 0), [sessions, active, elapsed]);
  const focusedWeek = useMemo(() => sessions.filter((session) => isThisWeek(session.date)).reduce((sum, session) => sum + session.seconds, 0) + (active ? elapsed : 0), [sessions, active, elapsed]);
  const remainingTasks = tasks.filter((task) => !task.done).length;
  const progress = Math.min(100, Math.round((focusedToday / (settings.dailyMinimum * 60)) * 100));
  const weekProgress = Math.min(100, Math.round((focusedWeek / (settings.weeklyGoal * 3600)) * 100));
  const streak = calculateCurrentStreak(sessions, settings.dailyMinimum * 60);

  useEffect(() => { playStartup(); }, []);
  useEffect(() => () => stopFinishSong(), []);
  useEffect(() => { localStorage.setItem("study-instrument:tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem("study-instrument:sessions", JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { localStorage.setItem("study-instrument:settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem("study-instrument:notificationsEnabled", JSON.stringify(notificationsEnabled)); }, [notificationsEnabled]);
  useEffect(() => {
    if (!active || startedAt === null) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick(); const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);
  useEffect(() => {
    if (!notificationsEnabled) return;
    const checkReminder = () => {
      // ELECTRON: skip the browser permission check when running in Electron.
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI?.isElectron && (!("Notification" in window) || Notification.permission !== "granted")) return;
      const now = new Date();
      const time = now.toTimeString().slice(0, 5);
      const reminderKey = `study-instrument:nag:${toLocalDateKey()}-${time}`;
      if (![settings.reminder, settings.secondReminder].includes(time) || focusedToday >= settings.dailyMinimum * 60 || localStorage.getItem(reminderKey)) return;
      localStorage.setItem(reminderKey, "sent");
      sendNotification("Study Instrument", streak ? `Your ${streak}-day streak is waiting.` : "You haven't studied today yet.");
    };
    checkReminder();
    const interval = window.setInterval(checkReminder, 30000);
    return () => window.clearInterval(interval);
  }, [notificationsEnabled, settings.reminder, settings.secondReminder, settings.dailyMinimum, focusedToday, streak]);

  const navigate = (next: Section) => { setSection(next); setShowMobileNav(false); setNotice(""); };
  const stopSong = () => { stopFinishSong(); setSongPlaying(false); };
  const startSession = () => {
    stopSong();
    const cleanSubject = subject.trim() || "Unspecified study";
    const seconds = Math.max(1, Number(duration) || settings.defaultDuration) * 60;
    setSubject(cleanSubject); setPlanned(seconds); setElapsed(0); setStartedAt(Date.now()); setPaused(false); setActive(true); setNotice("");
  };
  const saveSession = (seconds: number) => {
    setSessions((current) => [{ id: Date.now(), subject, seconds, date: toLocalDateKey(), start: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...current]);
    setActive(false); setPaused(false); setStartedAt(null); setElapsed(0);
  };
  // Manual finish: saves the session, no song
  const finishSession = () => {
    if (elapsed < 10) { setActive(false); setPaused(false); setStartedAt(null); setElapsed(0); toast("Session too short to log"); return; }
    saveSession(elapsed);
    setNotice("Session saved to history"); toast("Session saved");
  };
  // Automatic finish: the planned time ran out, so save and play the song
  useEffect(() => {
    if (!active || elapsed < planned) return;
    saveSession(planned);
    setNotice("Goal reached. Session saved to history"); toast("Session complete");
    startFinishSong(); setSongPlaying(true);
  }, [active, elapsed, planned]);
  const toggleTask = (id: number) => setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks((current) => [...current, { id: Date.now(), title: newTask.trim(), subject: newSubject.trim() || "No subject", done: false }]);
    setNewTask(""); setNewSubject(""); toast("Task added");
  };
  const deleteTask = (id: number) => setTasks((current) => current.filter((task) => task.id !== id));
  const updateSetting = (key: keyof Settings, value: string | number | boolean) => setSettings((current) => ({ ...current, [key]: value }));
  const enableNotifications = async () => {
    // ELECTRON: notifications are sent from the main process, no browser permission needed.
    if ((window as any).electronAPI?.isElectron) { setNotificationsEnabled(true); toast("Reminders enabled"); return; }
    if (!("Notification" in window)) { toast("Browser notifications are not supported here"); return; }
    const permission = await Notification.requestPermission();
    if (permission === "granted") { setNotificationsEnabled(true); toast("Reminders enabled"); }
    else toast("Notifications were not enabled");
  };

  return (
    <div className="app-shell" onClickCapture={(event) => { const button = (event.target as HTMLElement).closest("button"); if (button && !button.disabled && settings.soundEffects) playClick(); }}>
      <aside className={`sidebar ${showMobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-mark"><span className="brand-dot" /><span>Return</span></div>
        <div className="sidebar-rule" />
        <p className="eyebrow sidebar-label">Workspace</p>
        <nav className="primary-nav" aria-label="Primary navigation">
          <NavItem icon={<Zap size={16} />} label="Focus" active={section === "focus"} onClick={() => navigate("focus")} />
          <NavItem icon={<LayoutList size={16} />} label="Tasks" count={remainingTasks} active={section === "tasks"} onClick={() => navigate("tasks")} />
          <NavItem icon={<HistoryIcon size={16} />} label="History" active={section === "history"} onClick={() => navigate("history")} />
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-mini"><div className="streak-mini-icon"><Flame size={15} /></div><div><span>Streak</span><strong>{streak} <em>days</em></strong></div><ChevronRight size={14} /></div>
          <button className={`nav-item settings-link ${section === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Settings2 size={16} /><span>Settings</span></button>
          <p className="v1-note">V1 / 4 surfaces</p>
        </div>
      </aside>
      <main className="main-canvas">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setShowMobileNav(!showMobileNav)}><Menu size={19} /></button>
          <div className="topbar-meta"><span className="live-dot" /> <span>Local session</span><span className="topbar-date">{todayLabel()}</span></div>
          <div className="breadcrumb"><span>Lock in</span><span className="slash">/</span><strong>{section}</strong></div>
          <div className="window-controls">
            <span className="window-control minimize" role="button" aria-label="Minimize" onClick={() => (window as any).electronAPI?.minimizeWindow?.()} />
            <span className="window-control zoom" role="button" aria-label="Maximize" onClick={() => (window as any).electronAPI?.toggleMaximizeWindow?.()} />
            <span className="window-control close" role="button" aria-label="Close" onClick={() => (window as any).electronAPI?.closeWindow?.()} />
          </div>
        </header>
        <div className="mobile-nav-row">
          {(["focus", "tasks", "history", "settings"] as Section[]).map((item) => <button key={item} className={section === item ? "selected" : ""} onClick={() => navigate(item)}>{item}</button>)}
        </div>
        <div className="page-content">
          {notice && <div className="notice"><CheckCircle2 size={15} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
          {songPlaying && <div className="notice"><Zap size={15} />Session complete<button onClick={stopSong} aria-label="Stop music" style={{ width: "auto", padding: "0 10px" }}>Stop music</button></div>}
          {section === "focus" && <FocusView active={active} paused={paused} subject={subject} duration={duration} elapsed={elapsed} planned={planned} startedAt={startedAt} sessionNumber={sessions.length + (active || paused ? 1 : 0)} focusedToday={focusedToday} focusedWeek={focusedWeek} weekProgress={weekProgress} remainingTasks={remainingTasks} nextTasks={tasks.filter((task) => !task.done).slice(0, 3)} progress={progress} streak={streak} settings={settings} onSubject={setSubject} onDuration={setDuration} onStart={startSession} onFinish={finishSession} onPause={() => { setActive(false); setPaused(true); }} onResume={() => { setStartedAt(Date.now() - elapsed * 1000); setPaused(false); setActive(true); }} onNavigate={navigate} />}
          {section === "tasks" && <TasksView tasks={tasks} newTask={newTask} newSubject={newSubject} onNewTask={setNewTask} onNewSubject={setNewSubject} onAdd={addTask} onToggle={toggleTask} onDelete={deleteTask} />}
          {section === "history" && <HistoryView sessions={sessions} focusedWeek={focusedWeek} weeklyGoal={settings.weeklyGoal} />}
          {section === "settings" && <SettingsView settings={settings} notificationsEnabled={notificationsEnabled} onEnableNotifications={enableNotifications} onUpdate={updateSetting} />}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, count, active, onClick }: { icon: React.ReactNode; label: string; count?: number; active: boolean; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{count !== undefined && <small>{count}</small>}</button>;
}

function FocusView({ active, paused, subject, duration, elapsed, planned, startedAt, sessionNumber, focusedToday, focusedWeek, weekProgress, remainingTasks, nextTasks, progress, streak, settings, onSubject, onDuration, onStart, onFinish, onPause, onResume, onNavigate }: { active: boolean; paused: boolean; subject: string; duration: number; elapsed: number; planned: number; startedAt: number | null; sessionNumber: number; focusedToday: number; focusedWeek: number; weekProgress: number; remainingTasks: number; nextTasks: Task[]; progress: number; streak: number; settings: Settings; onSubject: (value: string) => void; onDuration: (value: number) => void; onStart: () => void; onFinish: () => void; onPause: () => void; onResume: () => void; onNavigate: (section: Section) => void }) {
  return <>
    <div className="page-heading focus-heading"><div><p className="eyebrow">Focus Session</p><h1>Just start.</h1><p className="lede">Close the gap between wanting to study and actually studying. Get on with it.</p></div><div className="heading-chip"><span className="chip-line" />{active ? "Session in progress" : "Ready when you are"}</div></div>
    <div className="focus-grid">
      <section className={`surface timer-surface ${active ? "is-active" : paused ? "is-paused" : ""}`}>
        {active || paused ? <div className="active-session">
          <div className="session-player-head"><span className="eyebrow">Focus session</span><span>Session {String(sessionNumber).padStart(2, "0")}</span></div>
          <div className="timer-topline"><span className="session-status"><span className="running-dot" />{active ? "FOCUSING" : "PAUSED"}</span><span className="timer-subject">{subject}</span></div>
          <div className="timer-display">{formatTime(elapsed)}</div>
          <div className="timer-goal"><span>Goal {formatShort(planned)}</span><span>{Math.min(100, Math.round((elapsed / planned) * 100))}% committed</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, (elapsed / planned) * 100)}%` }} /></div>
          <div className="session-meta"><span>Started {startedAt ? new Date(startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"} · Finishes ~{active && startedAt ? new Date(startedAt + planned * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "paused"}</span><span>Local session · study instrument</span></div>
          <div className="timer-actions">{active ? <button className="button ghost" onClick={onPause}><Square size={14} fill="currentColor" />Pause</button> : <button className="button ghost" onClick={onResume}><Play size={14} fill="currentColor" />Resume</button>}<button className="button primary" onClick={onFinish}><Check size={15} />Finish session</button></div>
          <p className="timer-footnote"><Clock3 size={13} /> {paused ? "Timer held. Resume when you are ready." : "Time is logged when you finish. Take a break whenever you need one."}</p>
        </div> : <div className="setup-session">
          <div className="setup-icon"><TimerReset size={19} /></div><p className="eyebrow">Start a session</p><h2>What are you working on?</h2>
          <label className="field-label" htmlFor="subject">Subject or intention</label><input id="subject" className="text-input large" value={subject} onChange={(event) => onSubject(event.target.value)} placeholder="e.g. Analyse numérique" />
          <label className="field-label" htmlFor="duration">Duration <span>minutes</span></label><div className="duration-input"><input id="duration" type="number" min="1" max="600" className="text-input large" value={duration} onChange={(event) => onDuration(Number(event.target.value))} /><span>min</span></div>
          <button className="button primary start-button" onClick={onStart}><Play size={15} fill="currentColor" />Start session <span>↵</span></button>
          <p className="setup-note">No plan required. Just name what you intend to do and make a small promise to yourself.</p>
        </div>}
      </section>
      <aside className="focus-rail">
        <div className="rail-card daily-card"><div className="card-label-row"><span className="eyebrow">Today</span><span className="muted">{progress}% of minimum</span></div><div className="rail-number">{formatShort(focusedToday)}</div><div className="mini-progress"><span style={{ width: `${progress}%` }} /></div><div className="rail-caption"><span>{settings.dailyMinimum}m daily minimum</span><span>{remainingTasks} tasks left</span></div></div>
        <div className="rail-card"><div className="card-label-row"><span className="eyebrow">This week</span><span className="muted">{weekProgress}%</span></div><div className="rail-number">{formatShort(focusedWeek)} <small>/ {settings.weeklyGoal}h</small></div><div className="week-ticks"><span /><span /><span /><span /><span /><span /><span /></div><div className="rail-caption"><span>Weekly volume</span><button onClick={() => onNavigate("history")}>View history <ChevronRight size={12} /></button></div></div>
        <div className="rail-card streak-card"><div className="streak-orbit"><Flame size={21} /></div><div><span className="eyebrow">Streak</span><div className="streak-number">{streak}<small> days</small></div></div><div className="streak-rule">30m / day<br /><span>keeps it alive</span></div></div>
        <div className="rail-tasks"><div className="card-label-row"><span className="eyebrow">Next up</span><button className="text-link" onClick={() => onNavigate("tasks")}>All tasks <ChevronRight size={12} /></button></div>{nextTasks.length ? nextTasks.map((task, index) => <button className="rail-task" key={task.id} onClick={() => onNavigate("tasks")}><span className={`task-dot ${index === 0 ? "accent" : ""}`} />{task.title}<ChevronRight size={13} /></button>) : <button className="rail-task empty-rail-task" onClick={() => onNavigate("tasks")}><span className="task-dot" />No tasks yet — add one <ChevronRight size={13} /></button>}</div>
      </aside>
    </div>
  </>;
}

function TasksView({ tasks, newTask, newSubject, onNewTask, onNewSubject, onAdd, onToggle, onDelete }: { tasks: Task[]; newTask: string; newSubject: string; onNewTask: (value: string) => void; onNewSubject: (value: string) => void; onAdd: () => void; onToggle: (id: number) => void; onDelete: (id: number) => void }) {
  const open = tasks.filter((task) => !task.done); const done = tasks.filter((task) => task.done);
  return <><div className="page-heading"><div><p className="eyebrow">Tasks / Today</p><h1>What are we doing today ?</h1><p className="lede">A flat list for the things you actually intend to do today.</p></div><div className="task-count"><strong>{open.length}</strong><span>remaining</span></div></div><div className="content-grid"><section className="surface task-surface"><div className="section-bar"><div><span className="eyebrow">Open tasks</span><h2>Today</h2></div><span className="muted">{open.length} of {tasks.length}</span></div><div className="add-task-row"><input className="text-input" value={newTask} onChange={(event) => onNewTask(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onAdd()} placeholder="Add a task" /><input className="text-input subject-input" value={newSubject} onChange={(event) => onNewSubject(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onAdd()} placeholder="Subject (optional)" /><button className="icon-button accent-button" onClick={onAdd} aria-label="Add task"><Plus size={17} /></button></div><div className="task-list">{open.length ? open.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />) : <p className="empty-tasks">Nothing planned.</p>}</div>{done.length > 0 && <div className="completed-group"><div className="completed-title"><span>Completed</span><span>{done.length}</span></div>{done.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />)}</div>}</section><aside className="side-note"><div className="side-note-mark"><Check size={16} /></div><p className="eyebrow">The rule</p><h3>Keep it boring.</h3><p>Tasks are here to remove the decision from the moment you sit down. No projects, dependencies, or planning system.</p></aside></div></>;
}
function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: (id: number) => void; onDelete: (id: number) => void }) { return <div className={`task-row ${task.done ? "done" : ""}`}><button className="check-button" onClick={() => onToggle(task.id)} aria-label={task.done ? "Mark incomplete" : "Mark complete"}>{task.done ? <Check size={14} /> : <Circle size={16} />}</button><div className="task-copy"><span>{task.title}</span><small>{task.subject}</small></div><button className="row-delete" onClick={() => onDelete(task.id)} aria-label="Delete task"><Trash2 size={14} /></button></div>; }

function HistoryView({ sessions, focusedWeek, weeklyGoal }: { sessions: Session[]; focusedWeek: number; weeklyGoal: number }) {
  const days = getWeekDays(sessions);
  const max = Math.max(1, ...days.map((day) => day.value));
  const average = sessions.length ? sessions.reduce((sum, session) => sum + session.seconds, 0) / sessions.length : 0;
  const longest = sessions.length ? Math.max(...sessions.map((session) => session.seconds)) : 0;
  return <><div className="page-heading"><div><p className="eyebrow">History / Record</p><h1>Weekly history</h1><p className="lede">Raw hours and sessions. No score attached.</p></div><div className="heading-meta"><span>This week</span><strong>{formatShort(focusedWeek)} <small>/ {weeklyGoal}h</small></strong></div></div><div className="history-layout"><section className="surface week-surface"><div className="section-bar"><div><span className="eyebrow">Weekly volume</span><h2>Focused hours</h2></div><span className="history-goal">Goal {weeklyGoal}h</span></div><div className="chart"><div className="y-labels"><span>5h</span><span>2.5h</span><span>0</span></div><div className="bars">{days.map((day) => <div className="bar-column" key={day.day}><div className="bar-wrap"><div className="bar" style={{ height: `${(day.value / max) * 100}%` }}><span>{day.value.toFixed(1)}h</span></div></div><small>{day.day}</small></div>)}</div></div><div className="history-stats"><Stat label="Average session" value={formatShort(average)} /><Stat label="Sessions logged" value={`${sessions.length}`} /><Stat label="Longest session" value={formatShort(longest)} /></div></section><section className="surface recent-surface"><div className="section-bar"><div><span className="eyebrow">Log</span><h2>Recent sessions</h2></div><button className="more-button"><MoreHorizontal size={17} /></button></div><div className="session-list">{sessions.map((session) => <div className="session-row" key={session.id}><div className="session-date">{formatSessionDate(session.date)}<small>{session.start}</small></div><div className="session-subject">{session.subject}<small>Focused study</small></div><strong>{formatShort(session.seconds)}</strong></div>)}</div>{!sessions.length && <p className="empty-history">Nothing here yet.<br />Start somewhere.</p>}</section></div></>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function SettingsView({ settings, notificationsEnabled, onEnableNotifications, onUpdate }: { settings: Settings; notificationsEnabled: boolean; onEnableNotifications: () => void; onUpdate: (key: keyof Settings, value: string | number | boolean) => void }) {
  return <><div className="page-heading"><div><p className="eyebrow">Settings & Nagging</p><h1>Adjust the nagging.</h1><p className="lede">Small controls for the reminders that help you come back.</p></div></div><div className="settings-layout"><section className="surface settings-surface"><SettingGroup title="Daily minimum" description="The focused minutes that keep your streak alive."><div className="setting-inline"><input className="text-input small-number" type="number" min="1" value={settings.dailyMinimum} onChange={(event) => onUpdate("dailyMinimum", Number(event.target.value))} /><span>minutes / day</span></div></SettingGroup><SettingGroup title="Default session" description="Prefills the session length on Focus."><div className="setting-inline"><input className="text-input small-number" type="number" min="1" value={settings.defaultDuration} onChange={(event) => onUpdate("defaultDuration", Number(event.target.value))} /><span>minutes</span></div></SettingGroup><SettingGroup title="Weekly goal" description="A volume target, not a productivity score."><div className="setting-inline"><input className="text-input small-number" type="number" min="1" value={settings.weeklyGoal} onChange={(event) => onUpdate("weeklyGoal", Number(event.target.value))} /><span>hours / week</span></div></SettingGroup><div className="setting-divider" /><SettingGroup title="Interface sounds" description="Button clicks. The completion song always plays when a session ends."><button className={`sound-toggle ${settings.soundEffects ? "selected" : ""}`} onClick={() => onUpdate("soundEffects", !settings.soundEffects)}><span className="sound-switch"><span /></span>{settings.soundEffects ? "Enabled" : "Disabled"}</button></SettingGroup><SettingGroup title="Nagging" description="Reminders are direct, factual, and easy to turn off."><div className="nag-fields"><label><span>First reminder</span><input className="text-input" type="time" value={settings.reminder} onChange={(event) => onUpdate("reminder", event.target.value)} /></label><label><span>Second reminder</span><input className="text-input" type="time" value={settings.secondReminder} onChange={(event) => onUpdate("secondReminder", event.target.value)} /></label></div><div className="nag-level"><span>Level</span>{["gentle", "medium", "aggressive"].map((level) => <button key={level} className={settings.nagLevel === level ? "selected" : ""} onClick={() => onUpdate("nagLevel", level)}><span className="radio" />{level}</button>)}</div></SettingGroup></section><aside className="settings-aside"><div className="nag-preview"><Bell size={17} /><p className="eyebrow">Preview</p><p>“You haven't studied today. Your <strong>streak is waiting</strong>.”</p><span>{settings.reminder} · {settings.nagLevel} nag</span><button className="button ghost notification-button" onClick={onEnableNotifications}>{notificationsEnabled ? "Reminders enabled" : "Enable browser reminders"}</button></div><div className="settings-note"><p className="eyebrow">Privacy</p><p>V1 stores everything in this browser only. No account, no webcam, no tracking.</p></div></aside></div></>;
}
function SettingGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <div className="setting-group"><div><h3>{title}</h3><p>{description}</p></div>{children}</div>; }