export type RandomSource = () => number;

export function shuffle<T>(
  input: readonly T[],
  random: RandomSource = Math.random,
): T[] {
  const result = [...input];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError("Random source must return a number from 0 up to 1");
    }

    const swapIndex = Math.floor(value * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }

  return result;
}
