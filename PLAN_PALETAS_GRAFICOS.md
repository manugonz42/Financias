# Plan (WIP): paletas de color seleccionables (global + por widget) + sombreado del rosco

> Documento de trabajo para continuar la implementación en otro equipo.
> Aún NO implementado. El rediseño "Linear" previo SÍ está hecho y commiteado.

## Contexto

El rediseño "Linear" (near-black, Inter + JetBrains Mono, widget mes pasado/este
mes) **ya está hecho y commiteado** (`754c3d3`). Tras verlo, el usuario pide dos
ajustes sobre los gráficos:

1. **Sombreado del rosco**: el degradado lineal actual queda **metálico**. Quitarlo
   y dejar color plano con **una sombra muy sutil solo en los bordes interior y
   exterior** de cada porción (no un degradado horizontal).
2. **Paletas de color**: poder elegir entre **varias paletas** (no una sola). Debe
   poder seleccionarse **global en Ajustes** y, además, **override por widget** desde
   un botón de paleta presente en **todos los gráficos**. En los gráficos no
   categóricos (barras, línea, efectivo, calendario) la paleta solo cambia el
   acento/escala; en rosco y sunburst pinta cada porción.

La paleta aplica **solo a los gráficos**; NO reescribe el color guardado de las
categorías (siguen igual en etiquetas, presupuestos, etc.). Repo público: sin PII.

## Decisiones del usuario
- Selección **Ambos**: global por defecto en Ajustes + override por widget.
- Botón de paleta en **todos** los widgets de gráfico.
- Paletas: **Joya, Neón, Pastel, Curado** + **Categoría** (colores actuales por
  categoría = comportamiento por defecto).

## Cambios

### 1. Sombreado sutil del rosco/sunburst (quitar lo metálico)
`src/components/charts/nivo.tsx`, en `NivoDonut` y `NivoSunburst`:
- **Quitar** el `defs`/`fill` con `linearGradientDef("sliceShade", …)` (el aspecto
  metálico).
- Color plano + **borde apenas más oscuro** que define el arco interior/exterior:
  `borderWidth={1.5}` y `borderColor={{ from: "color", modifiers: [["darker", 0.5]] }}`.
  (Da "algo muy poco de sombra" en los bordes, sin degradado.)

### 2. Definición de paletas (nuevo)
`src/lib/palettes.ts`:
```ts
export type PaletteId = "categoria" | "joya" | "neon" | "pastel" | "curado";
export const PALETTES: { id: PaletteId; label: string; colors: string[] }[] = [...]
// joya:   #10b981 #3b82f6 #e11d48 #8b5cf6 #f59e0b #14b8a6 #ec4899 #0ea5e9 #84cc16 #f43f5e
// neon:   #22d3ee #f472b6 #a78bfa #a3e635 #fb923c #2dd4bf #facc15 #60a5fa #fb7185 #34d399
// pastel: #86efac #93c5fd #fca5a5 #c4b5fd #fcd34d #5eead4 #f9a8d4 #a5b4fc
// curado: #4e79a7 #f28e2b #e15759 #76b7b2 #59a14f #edc948 #b07aa1 #ff9da7 #9c755f #bab0ac
export function paletteColors(id: PaletteId): string[] | null; // null = "categoria"
```

### 3. Estado global (mirror del patrón `theme`)
- `src/data/settings.ts`: `getChartPalette()/setChartPalette()` sobre la key
  `chart_palette` (reutiliza `getSetting/setSetting`, que ya existen).
- `src/state/AppContext.tsx`: añadir `palette: PaletteId` + `setPalette` (cargar en
  el `Promise.all` del init; el setter persiste y hace `setVersion(v=>v+1)` para
  re-render de gráficos, igual que `setTheme`).

### 4. Override por widget + hook
- Override por widget en `settings` con key `palette:<widgetKey>`
  (`"inherit"` | PaletteId), vía `getSetting/setSetting`.
- Hook `useChartPalette(widgetKey)` (en `src/components/charts/useChartPalette.ts`):
  lee el override (estado local, cargado on-mount), lo combina con el `palette`
  global de `useApp()`; devuelve `{ effectiveId, colors, override, setOverride }`.
- `WidgetProps` (en `src/widgets/widgets.tsx`): añadir `widgetKey?: string`; en
  `src/views/Dashboard.tsx` (`WidgetChrome`) pasar `widgetKey={def.key}` al `Body`.

### 5. Menú de paleta por widget (sustituye a ColorModeMenu)
- `src/components/PaletteMenu.tsx` (nuevo): icono paleta (SVG inline, mismo patrón
  que el actual `ColorModeMenu`) que abre menú con: **Usar global** (inherit) +
  Categoría + Joya + Neón + Pastel + Curado, marcando el activo y mostrando una
  mini-muestra de colores por opción. Llama a `setOverride`.
- **Eliminar** `src/components/ColorModeMenu.tsx` (y su uso/estado `gradientColor`
  en el rosco), reemplazado por este flujo.

### 6. Aplicar la paleta en los gráficos
`src/components/charts/nivo.tsx`: cada componente acepta `palette?: string[] | null`:
- **Rosco/Sunburst**: si hay `colors`, pintar por índice (`colors[i % n]`); si es
  `null` (categoría), usar el color de cada categoría (actual).
- **Barras gastos/ingresos** (`NivoFlows`): si hay paleta, Gastos=`colors[0]`,
  Ingresos=`colors[1]`; si no, rojo/verde semántico (actual).
- **Línea** (`NivoBalance`) y **Efectivo** (`NivoCash`): acento = `colors[0]` o el
  actual.
- **Calendario** (`NivoCalendar`): escala = primeros ~5 de `colors` o la actual.

`src/widgets/widgets.tsx`: cada Body de gráfico usa `useChartPalette(p.widgetKey)`,
pasa `palette={colors}` a su componente Nivo y portatea `<PaletteMenu …/>` al
`headerSlot` (junto al calendario donde aplique).

### 7. Selector global en Ajustes
`src/views/Ajustes.tsx`: un `<select>` "Paleta de gráficos" (Categoría/Joya/Neón/
Pastel/Curado) que llama a `setPalette` del contexto.

## Archivos
- nuevos: `src/lib/palettes.ts`, `src/components/PaletteMenu.tsx`,
  `src/components/charts/useChartPalette.ts`
- modificados: `src/components/charts/nivo.tsx`, `src/widgets/widgets.tsx`,
  `src/views/Dashboard.tsx`, `src/state/AppContext.tsx`, `src/data/settings.ts`,
  `src/views/Ajustes.tsx`
- eliminado: `src/components/ColorModeMenu.tsx`

## Pendiente aparte (no en esta tanda)
- **Parser BBVA** (~128 movimientos descartados al importar): requiere el PDF / el
  detalle de avisos del usuario. En `Importar.tsx` ya hay un desplegable que lista
  los avisos para diagnosticar.

## Verificación
1. `npx tsc --noEmit` y `npx vite build` sin errores.
2. `npm run tauri dev`:
   - Rosco/sunburst: porciones planas con borde sutil (sin look metálico).
   - Ajustes → "Paleta de gráficos": cambiarla repinta todos los gráficos.
   - Botón 🎨 en cada gráfico: "Usar global" + paletas; el override por widget
     persiste al recargar y prevalece sobre el global.
   - Barras siguen rojo/verde con "Categoría"; con una paleta usan sus 2 primeros
     colores.
