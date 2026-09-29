"use client";
import { useEffect, useRef } from "react";
import { criaGlobo, type OpcoesGlobo } from "@/lib/client/globo";

export function Globo({ className, opcoes }: { className?: string; opcoes: OpcoesGlobo }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chave = JSON.stringify(opcoes);
  useEffect(() => {
    if (!ref.current) return;
    const leve = window.innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4;
    const o = JSON.parse(chave) as OpcoesGlobo;
    const g = criaGlobo(ref.current, leve ? { ...o, pontos: Math.round(o.pontos * 0.6), malha: false } : o);
    return () => g.parar();
  }, [chave]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
