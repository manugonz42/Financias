// Formato de moneda y fechas (locale es-ES).

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEUR(n: number): string {
  return eur.format(n);
}

/** Formatea un número sin símbolo, estilo español (1.234,56). */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** "2026-06-19" -> "19/06/2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-06-19" -> "2026-06" (clave de mes). */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** "2026-06" -> "Junio 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
}

/** "2026-06" -> "jun 26" (etiqueta compacta para ejes de gráficos). */
export function monthLabelShort(key: string): string {
  const [y, m] = key.split("-");
  return `${MESES[Number(m) - 1].slice(0, 3).toLowerCase()} ${y.slice(2)}`;
}
