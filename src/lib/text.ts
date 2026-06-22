// Utilidades de texto compartidas.

/** Normaliza a MAYÚSCULAS, sin acentos y con espacios colapsados. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita diacríticos
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clave de deduplicado de un movimiento. Dos importaciones del mismo
 * movimiento producen la misma clave, de modo que al reimportar un PDF se
 * detectan como duplicados. No se hashea: la clave compuesta ya es única.
 */
export function dedupeKey(
  accountId: number,
  fechaOperacion: string,
  importe: number,
  concepto: string,
): string {
  return `${accountId}|${fechaOperacion}|${importe.toFixed(2)}|${normalize(concepto)}`;
}
