const UINT32_RANGE = 0x1_0000_0000;
const UNIT_RANGE = 0x20_0000_0000_0000;

export type Uint32Filler = (values: Uint32Array) => void;

function fillRandomValues(values: Uint32Array): void {
  try {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.getRandomValues) {
      cryptoApi.getRandomValues(values);
      return;
    }
  } catch {
    // Use the non-cryptographic fallback in restricted runtimes.
  }

  for (let index = 0; index < values.length; index += 1) {
    values[index] = Math.floor(Math.random() * UINT32_RANGE);
  }
}

export function randomUnit(fill: Uint32Filler = fillRandomValues): number {
  const words = new Uint32Array(2);
  fill(words);
  const highBits = words[0] >>> 5;
  const lowBits = words[1] >>> 6;
  return (highBits * 0x400_0000 + lowBits) / UNIT_RANGE;
}

export function randomInteger(maxExclusive: number, fill: Uint32Filler = fillRandomValues): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError("Random integer range must be an integer from 1 through 2^32.");
  }

  const acceptanceLimit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  const word = new Uint32Array(1);
  do {
    fill(word);
  } while (word[0] >= acceptanceLimit);
  return word[0] % maxExclusive;
}
