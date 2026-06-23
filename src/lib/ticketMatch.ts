// Empareja un ticket (fecha + total + texto) con movimientos bancarios.
// Señal fuerte: el importe del movimiento coincide con el total del ticket.
// Señales de apoyo: cercanía de fecha y coincidencia de palabras (comercio).
// Devuelve candidatos ordenados; el usuario confirma siempre.

import { normalize } from "./text";

export interface MatchTx {
  id: number;
  fecha: string; // 'YYYY-MM-DD' (o ISO; se usa el prefijo de 10)
  importe: number; // negativo = gasto
  merchant: string | null;
  concepto: string;
}

export interface TicketInfo {
  date: string | null; // 'YYYY-MM-DD'
  total: number | null;
  text: string; // texto del ticket (líneas unidas) para palabras clave
}

export interface Candidate {
  tx: MatchTx;
  score: number;
}

const DAY_WINDOW = 4;
const AMOUNT_TOL = 0.02;

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T00:00:00`).getTime();
  const db = new Date(`${b.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((da - db) / 86400000);
}

/** Palabras significativas del ticket (normalizadas, longitud ≥ 4, únicas). */
export function ticketTokens(text: string): string[] {
  const seen = new Set<string>();
  for (const w of normalize(text).split(/[^a-z0-9]+/i)) {
    if (w.length >= 4) seen.add(w);
  }
  return [...seen];
}

export function matchTicket(ticket: TicketInfo, txs: MatchTx[]): Candidate[] {
  const tokens = ticketTokens(ticket.text);
  const out: Candidate[] = [];

  for (const tx of txs) {
    if (tx.importe >= 0) continue; // un ticket es un gasto

    let score = 0;

    // Importe: si conocemos el total, debe cuadrar para ser candidato.
    if (ticket.total != null) {
      if (Math.abs(Math.abs(tx.importe) - ticket.total) <= AMOUNT_TOL) score += 100;
      else continue;
    }

    // Fecha: cuanto más cerca, mejor. Sin total, la fecha es obligatoria.
    if (ticket.date) {
      const dd = Math.abs(daysBetween(ticket.date, tx.fecha));
      if (dd > DAY_WINDOW) {
        if (ticket.total == null) continue;
      } else {
        score += 30 - dd * 5;
      }
    } else if (ticket.total == null) {
      continue; // sin fecha ni total no hay nada con qué emparejar
    }

    // Palabras clave (comercio/concepto).
    const txText = normalize(`${tx.merchant ?? ""} ${tx.concepto}`);
    const hits = tokens.filter((t) => txText.includes(t)).length;
    score += hits * 10;

    out.push({ tx, score });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 6);
}
