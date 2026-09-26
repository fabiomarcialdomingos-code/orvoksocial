"use client";

import { useEffect, useState } from "react";

export function LiveClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("pt-BR"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span suppressHydrationWarning>{time ?? "--:--:--"}</span>;
}
