"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Cell = "X" | "O" | null;

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

function winner(board: Cell[]) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function winningMove(board: Cell[], mark: "X" | "O") {
  for (const [a, b, c] of WIN_LINES) {
    const cells = [board[a], board[b], board[c]];
    const marks = cells.filter((cell) => cell === mark).length;
    const empty = [a, b, c].find((index) => board[index] == null);
    if (marks === 2 && empty != null) return empty;
  }
  return null;
}

function chooseChefMove(board: Cell[]) {
  const win = winningMove(board, "O");
  if (win != null) return win;

  // El Chef bloquea con frecuencia, pero no siempre: la prueba debe poder ganarse.
  const block = winningMove(board, "X");
  if (block != null && Math.random() < 0.72) return block;

  const available = board
    .map((cell, index) => (cell == null ? index : -1))
    .filter((index) => index >= 0);

  if (!available.length) return null;

  const preferred = [4, 0, 2, 6, 8, 1, 3, 5, 7].filter((index) =>
    available.includes(index),
  );

  const pool = Math.random() < 0.65 ? preferred.slice(0, Math.min(4, preferred.length)) : available;
  return pool[Math.floor(Math.random() * pool.length)] ?? available[0];
}

export default function ClubTicTacToeChallenge() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [chefThinking, setChefThinking] = useState(false);
  const [started, setStarted] = useState(false);
  const [wins, setWins] = useState(0);
  const timerRef = useRef<number | null>(null);

  const result = useMemo(() => {
    const won = winner(board);
    if (won) return won;
    if (board.every(Boolean)) return "DRAW" as const;
    return null;
  }, [board]);

  const yourTurn = started && !chefThinking && !result;

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (result === "X") setWins((current) => current + 1);
  }, [result]);

  function restart() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setBoard(Array(9).fill(null));
    setChefThinking(false);
    setStarted(true);
  }

  function play(index: number) {
    if (!started || chefThinking || result || board[index]) return;

    const next = [...board];
    next[index] = "X";
    setBoard(next);

    if (winner(next) || next.every(Boolean)) return;

    setChefThinking(true);
    timerRef.current = window.setTimeout(() => {
      const move = chooseChefMove(next);
      if (move != null) {
        const afterChef = [...next];
        afterChef[move] = "O";
        setBoard(afterChef);
      }
      setChefThinking(false);
      timerRef.current = null;
    }, 520);
  }

  const status =
    result === "X"
      ? "¡Le ganaste al Chef!"
      : result === "O"
        ? "El Chef ganó esta ronda"
        : result === "DRAW"
          ? "Empate. Estuvo cerca."
          : chefThinking
            ? "El Chef está pensando…"
            : started
              ? "Tu turno"
              : "¿Le ganas al Chef?";

  return (
    <section className="overflow-hidden rounded-[28px] border border-red-500/20 bg-[radial-gradient(circle_at_90%_0%,rgba(226,26,34,.22),transparent_28%),linear-gradient(145deg,#151111,#0d0d0d)]">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_330px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#e21a22] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
              Reto Alentó
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white/45">
              Modo prueba
            </span>
          </div>

          <h2 className="mt-3 text-[26px] font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-[32px]">
            Gana en Triqui y desbloquea un borde gratis.
          </h2>
          <p className="mt-3 max-w-[520px] text-[11px] leading-5 text-white/42">
            Esta primera versión es solo para probar el juego y la experiencia dentro del Club. Todavía no crea un cupón real.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {!started ? (
              <button
                type="button"
                onClick={restart}
                className="h-11 rounded-full bg-[#e21a22] px-5 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(226,26,34,.24)]"
              >
                Jugar ahora
              </button>
            ) : (
              <button
                type="button"
                onClick={restart}
                className="h-11 rounded-full border border-white/10 bg-white/[0.05] px-5 text-[11px] font-black text-white/70"
              >
                Nueva partida
              </button>
            )}

            {wins > 0 && (
              <span className="inline-flex h-11 items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 text-[10px] font-bold text-emerald-300">
                Victorias de prueba: {wins}
              </span>
            )}
          </div>

          {result === "X" && (
            <div className="mt-5 rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-emerald-300">
                Premio de prueba desbloqueado
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <b className="block text-[16px] text-white">🧀 Borde gratis</b>
                  <span className="mt-1 block text-[10px] text-white/40">
                    En la siguiente etapa lo conectamos a un beneficio real.
                  </span>
                </div>
                <span className="rounded-full bg-emerald-400 px-3 py-1.5 text-[9px] font-black uppercase text-emerald-950">
                  Ganado
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/8 bg-black/20 p-5 md:border-l md:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/28">
                Partida
              </p>
              <b className="mt-1 block text-[14px] text-white">{status}</b>
            </div>
            <div className="text-right">
              <span className="block text-[9px] text-white/25">Tú</span>
              <b className="text-[14px] text-[#ff3439]">X</b>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Tablero de Triqui">
            {board.map((cell, index) => (
              <button
                key={index}
                type="button"
                onClick={() => play(index)}
                disabled={!yourTurn || Boolean(cell)}
                aria-label={
                  cell
                    ? `Casilla ${index + 1}: ${cell === "X" ? "tu jugada" : "Chef"}`
                    : `Jugar en casilla ${index + 1}`
                }
                className={
                  "aspect-square min-h-[72px] rounded-[16px] border text-[28px] font-black transition sm:min-h-[82px] " +
                  (cell === "X"
                    ? "border-red-500/30 bg-red-500/10 text-[#ff3439]"
                    : cell === "O"
                      ? "border-white/10 bg-white/[0.05] text-white"
                      : yourTurn
                        ? "border-white/10 bg-white/[0.035] text-white hover:bg-white/[0.07]"
                        : "border-white/[0.06] bg-white/[0.02] text-white/20")
                }
              >
                {cell ?? ""}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-[9px] text-white/28">
            <span>Chef Alentó = O</span>
            <span>3 en línea para ganar</span>
          </div>
        </div>
      </div>
    </section>
  );
}
