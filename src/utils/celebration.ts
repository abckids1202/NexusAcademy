import type { SpecialType } from "../types";
import { loadData } from "../services/storageService";

let audioContext: AudioContext | null = null;

export function shouldSkipSpinAnimation(): boolean {
  const systemPrefersReducedMotion = typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return document.documentElement.dataset.reducedMotion === "true" ||
    document.documentElement.dataset.animationsEnabled === "false" ||
    systemPrefersReducedMotion;
}

export function shouldCelebrateResult(type: SpecialType): boolean {
  return type === "rare" || type === "legendary" || type === "jackpot" || type === "bonus";
}

export function prepareSpinAudio(): boolean {
  if (!loadData().settings.soundsEnabled || typeof window === "undefined") return false;
  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) return false;

  try {
    audioContext ??= new AudioContextConstructor();
    if (audioContext.state === "suspended") void audioContext.resume().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export function playSpinAudio(type: SpecialType, enabled: boolean): void {
  if (!enabled || !audioContext || audioContext.state === "closed") return;

  const noteSets: Record<SpecialType, number[]> = {
    normal: [523],
    uncommon: [587, 740],
    rare: [659, 784, 988],
    legendary: [740, 932, 1175],
    jackpot: [659, 831, 1047, 1319],
    danger: [247, 196],
    mystery: [440, 554],
    bonus: [698, 880, 1175],
  };

  const play = () => {
    if (!audioContext || audioContext.state !== "running") return;
    const context = audioContext;
    const now = context.currentTime;
    noteSets[type].forEach((frequency, index) => {
      const start = now + index * 0.075;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.035, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  };

  if (audioContext.state === "running") {
    play();
  } else {
    void audioContext.resume().then(play).catch(() => undefined);
  }
}
