export type PackageErrorCategory = "aborted" | "unsupported";

export class PackageError extends Error {
  readonly category: PackageErrorCategory;

  constructor(category: PackageErrorCategory) {
    super(category);
    this.name = "PackageError";
    this.category = category;
  }
}

export function packageFailure(): never {
  throw new PackageError("unsupported");
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new PackageError("aborted");
}
