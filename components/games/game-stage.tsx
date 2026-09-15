import type { ReactNode } from "react";

export function GameStage({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="game-stage mx-auto grid w-full max-w-5xl content-center rounded-3xl border-2 border-[#16324f] bg-[#eef6f4] p-[clamp(0.75rem,3vw,1.5rem)] shadow-[6px_6px_0_#16324f]">
      {children}
    </div>
  );
}
