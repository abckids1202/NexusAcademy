export type UserSettings = {
  theme: "dark" | "light" | "system";
  reducedMotion: boolean;
  animationsEnabled: boolean;
  confettiEnabled: boolean;
  soundsEnabled: boolean;
  defaultSpinDurationMs: number;
  defaultVisualMode: "equal" | "weighted";
  defaultSpinMode: "normal" | "elimination" | "no-repeat" | "accumulation";
};
