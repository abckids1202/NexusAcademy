export const wheelPalette = [
  "#5b21b6",
  "#b45309",
  "#047857",
  "#b91c1c",
  "#0369a1",
  "#be185d",
  "#4d7c0f",
  "#be123c",
  "#15803d",
  "#a16207",
];

export function getDefaultOptionColor(index: number): string {
  return wheelPalette[index % wheelPalette.length];
}

export function getReadableTextColor(hexColor: string): string {
  const normalized = hexColor.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  if (Number.isNaN(value) || normalized.length !== 6) {
    return "#f8fafc";
  }

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 150 ? "#0f172a" : "#f8fafc";
}

/** Tone bright user colors down for the wheel surface without changing saved input data. */
export function getWheelDisplayColor(hexColor: string): string {
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6 || !/^[0-9a-f]{6}$/i.test(normalized)) return "#334155";
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const max = Math.max(red, green, blue) / 255;
  const min = Math.min(red, green, blue) / 255;
  const lightness = (max + min) / 2;
  const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max !== min) {
    if (max === red / 255) hue = 60 * (((green - blue) / 255) / (max - min));
    else if (max === green / 255) hue = 60 * (2 + ((blue - red) / 255) / (max - min));
    else hue = 60 * (4 + ((red - green) / 255) / (max - min));
  }
  if (hue < 0) hue += 360;
  const adjustedLightness = Math.min(0.56, Math.max(0.24, lightness * 0.72));
  const adjustedSaturation = Math.min(0.9, Math.max(0.48, saturation || 0.55));
  return `hsl(${Math.round(hue)} ${Math.round(adjustedSaturation * 100)}% ${Math.round(adjustedLightness * 100)}%)`;
}
