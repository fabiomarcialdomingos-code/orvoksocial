"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { initMetaPixel, trackMetaPageView } from "../lib/client/pixel";

/** Carrega o Meta Pixel uma vez e reemite PageView a cada navegação do App Router
 * (o fbevents.js só rastreia o carregamento inicial sozinho — sem isso, trocar de
 * página dentro do app não contaria como novo PageView). */
export function MetaPixel() {
  const pathname = usePathname();
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      initMetaPixel();
      return;
    }
    trackMetaPageView();
  }, [pathname]);

  return null;
}
