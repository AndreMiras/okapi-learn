"use client";

import { useEffect, useRef } from "react";

import type { GameAssetRegistry } from "@/lib/games/package/assets";

export function useGameAssets(assets: GameAssetRegistry | null): void {
  const lifecycle = useRef({ generation: 0 });
  useEffect(() => {
    const owner = lifecycle.current;
    const current = ++owner.generation;
    return () => {
      queueMicrotask(() => {
        if (owner.generation === current) assets?.dispose();
      });
    };
  }, [assets]);
}
