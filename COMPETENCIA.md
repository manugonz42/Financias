# Análisis competitivo — Financias

> Última actualización: 2026-06-23. Fuentes al final.

Financias compite en la **intersección** de dos categorías que hoy nadie cubre del todo:
app de **escritorio nativa**, **sin servidor ni cloud** (privacidad 100% local), que **importa
extractos de bancos españoles** (Openbank, Unicaja…) y los categoriza.

---

## Mundo 1 — Local-first / self-hosted (competencia técnica)

| App | Stack | Importa extractos | Pega / diferencia |
|-----|-------|-------------------|-------------------|
| **Firefly III** | PHP, self-hosted (servidor) | CSV, OFX, conexiones automáticas | El más completo: doble partida, multi-divisa. Requiere **servidor**, curva dura, no es desktop nativo |
| **Actual Budget** | JS, self-hosted (sync server) | CSV + bank sync (GoCardless EU) | UI muy pulida, envelope budgeting. Necesitas correr un **sync server** |
| **ezBookkeeping** | Self-hosted ligero | Sí | Minimalista, corre hasta en Raspberry Pi |
| **GnuCash** | Desktop nativo | OFX/QIF | Contabilidad seria, UI anticuada |

**Conclusión:** ninguno es un "doble-clic y funciona" para el usuario no técnico. Todos piden
montar servidor/Docker o son herramientas de contable. Financias es **Tauri** (binario nativo
ligero, sin servidor) → ahí hay hueco real.

## Mundo 2 — Mercado español

| App | Modelo | Clave |
|-----|--------|-------|
| **Fintonic** | Cloud, scraping PSD2 | Líder (~1.5M usuarios), conecta 150+ bancos, pero **envía datos a la nube** |
| **Cashual** | Manual, sin conexión banco | **Competidor más directo**: privacidad, control manual, cero publicidad. Pero es móvil/manual, **no parsea extractos** |
| **Wallet (BudgetBakers)** | Cloud freemium | Completa pero de pago |

**Conclusión:** Cashual valida la tesis (hay demanda de privacidad en España), pero ninguna
combina *fácil + privado + importación automática de extractos ES*.

---

## El nicho de Financias

```
Firefly/Actual → potentes pero requieren servidor (no aptos para usuario medio)
Fintonic       → fácil pero cloud + scraping de credenciales
Cashual        → privado pero manual y móvil
Financias      → fácil (binario) + privado (local) + automático (parsea extractos ES) ✅
```

## Features a vigilar para llegar al nivel y superar

Las más repetidas en los líderes (candidatas a roadmap):

1. **Net worth tracker** — patrimonio en el tiempo (lo tienen todos los top)
2. **Multi-divisa** (Firefly)
3. **Presupuestos tipo envelope** (Actual, YNAB)
4. **Reglas de categorización automática** (no solo guiada)
5. **Flujo de caja proyectado** (Quicken Simplifi)
6. **Soporte multi-banco español** — camino: Openbank → Unicaja → BBVA, Santander, CaixaBank…

---

## Fuentes
- NerdWallet — Best Budget Apps for 2026
- OpenAlternative — Firefly III alternatives
- ezBookkeeping — comparison vs Firefly vs Actual
- Cashual — Alternativas a Fintonic 2026
- Banktrack — Alternativas a Fintonic 2026
- Business Research Insights — Personal Finance App Market
