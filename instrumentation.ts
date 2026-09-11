export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    return import("@/lib/config/environment").then(({ parseServerConfig }) => {
      parseServerConfig(process.env);
    });
  }
}
