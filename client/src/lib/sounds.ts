import clickUrl from './assets/click.wav';
import finishUrl from './assets/finish.mp3';
import notificationUrl from './assets/notification.mp3';
import startupUrl from './assets/yawn.mp3';

const CLICK_VOLUME = 0.5;
const SONG_VOLUME = 0.6;
const NOTIFICATION_VOLUME = 0.7;
const STARTUP_VOLUME = 0.6;

const clickBase = new Audio(clickUrl);
clickBase.preload = 'auto';

export function playClick() {
    // Clone so rapid clicks overlap instead of cutting each other off
    const a = clickBase.cloneNode(true) as HTMLAudioElement;
    a.volume = CLICK_VOLUME;
    a.play().catch(() => { });
}

let song: HTMLAudioElement | null = null;

export function startFinishSong() {
    stopFinishSong();
    song = new Audio(finishUrl);
    song.loop = true;
    song.volume = SONG_VOLUME;
    song.play().catch(() => { });
}

export function stopFinishSong() {
    if (!song) return;
    song.pause();
    song.currentTime = 0;
    song = null;
}

// Plays once, no loop
export function playNotification() {
    const a = new Audio(notificationUrl);
    a.volume = NOTIFICATION_VOLUME;
    a.play().catch(() => { });
}

// Plays once per app launch, no loop. The flag stops React dev mode
// (which mounts components twice) from playing it twice.
let startupPlayed = false;
export function playStartup() {
    if (startupPlayed) return;
    startupPlayed = true;
    const a = new Audio(startupUrl);
    a.volume = STARTUP_VOLUME;
    a.play().catch(() => { });
}