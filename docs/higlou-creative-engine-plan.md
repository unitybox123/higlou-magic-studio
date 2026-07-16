# Higlou AI Creative Engine — Plan técnico

**Estado:** Fase 0 ✓ · Fase 1 ✓ · Fase 2 ✓ · Fase 3 ✓ · Fase 4 ✓ · Fase 5 ✓ · Fase 6 ✓ · Fase 7 ✓ · Fase 8 ✓ · Fase 9 ✓ · **Conversion Engine / AI Sales Studio (v10) — DONE**.  
**Fuente:** `docs/_source-creative-engine-prompt.txt` (export del DOCX oficial).  
**Principio central:** la fidelidad al producto real > creatividad. Nunca inventar vistas, piezas, medidas ni defectos.  
**Motor completo (DOCX):** Fases 1–9 cerradas. **v10** añade AI Sales Studio (story blueprints + tiers) sin romper Truth/Safety/export.

---

## 1. Arquitectura encontrada (repo actual)

| Capa | Tecnología | Rutas clave |
|------|------------|-------------|
| App | Next.js 16 App Router + React 19 + Tailwind 4 | `app/`, `components/` |
| API | Route Handlers Node (`app/api/**`) | sin servidor separado |
| DB / Auth / Storage | Supabase (Postgres, Auth, Storage `product-images`) | `lib/supabase/*`, `lib/images/storage.ts` |
| ORM | **Ninguno** (supabase-js) | — |
| Análisis producto | Quality → Fingerprint/Cache → ZXing → Vision OCR → OpenAI visión → Fusion → Confidence → Category/Specifics → HTML → CSV | `lib/ai/analyze-product.ts`, `ARCHITECTURE-V2.md` |
| Draft eBay | Plantilla oficial + `/api/generate-csv` | `lib/csv/ebay-template.ts`, `templates/ebay-draft-listing-template.csv` |
| Colas / jobs | **No existen** | todo sync + `maxDuration` |
| Generación de imagen | **Creative Engine Phase 1–9** (REAL_EDIT / COMPOSITE / CONTROLLED_GEN / CODE_INFOGRAPHIC + QA + CSV + costs) | `lib/creative/*` |

### Qué reutilizar (no reemplazar)

- Upload full-res → Supabase HTTPS (`image-uploader`, `upload-images`) — inputs del Creative Engine.
- `quality-engine`, fingerprint/cache, cost optimizer, `ai_usage_events`, budget gate.
- `NormalizedProduct` / analysis fusion como semilla del **Product Truth Record**.
- `new-listing-workspace` + CSV: el Creative Pack es módulo **hermano**, no un rewrite del draft.
- Branding Higlou (`#f4c928`, store name) para infografías por código.

### Gaps vs. el DOCX

- ~~Sin Image Role Classifier / Product Truth Record versionado.~~ → **Fase 2 DONE**
- ~~Sin Background removal / edit / gen / upscale providers.~~ → **Fase 3–5 DONE** (upscale still later).
- ~~Sin Safety / Planner / recipes / Creative DNA / pre-spend estimate.~~ → **Fase 4 DONE**.
- ~~Sin regeneración selectiva / jobs ligeros.~~ → **Fase 5 DONE**.
- ~~Sin Infografías por código.~~ → **Fase 6 DONE** — CODE_INFOGRAPHIC from confirmed Truth only.
- ~~Sin QA denso / retry / reject bloquea export.~~ → **Fase 7 DONE** — `creative-qa-v7`, scores_json.qa, export gate.
- ~~Sin “GENERATE CREATIVE PACK” → CSV Item photo URL (carrusel ordenado).~~ → **Fase 8 DONE** — `creative-ebay-v8`, `ebay-exporter`, `creativePackId` → Item photo URL.
- ~~Sin dashboard de costos creativos / límites / cache packs.~~ → **Fase 9 DONE** — `creative-costs-v9`, `creative_usage_events`, budget gate, `/usage` Creative section.
- **Conversion Engine / AI Sales Studio (v10)** — category story blueprints, Studio Brief + tiers (Basic→Ultimate), premium CODE layouts, `creative-conversion-v10`. UI name “AI Sales Studio”; DB stays `creative_*`.
- Sin HEIC en upload (hoy: jpeg/png/webp).

---

## 2. Arquitectura propuesta

```
Product Workspace (existente)
        │
        ▼
  [Generate Creative Pack]  ← nuevo CTA
        │
        ▼
 Creative Pack Orchestrator (API)
        │
   ┌────┴────┐
   │         │
Local prep  Product Truth
(hash,thumb, roles)
   │         │
   └────┬────┘
        ▼
 Safety Engine → Planner → Recipes
        │
        ▼
 Provider Router (cheapest safe)
   REAL_EDIT → remove.bg / local / OpenAI edit
   COMPOSITE → edit + scene
   CONTROLLED_GEN → Image Gen (solo si truth lo permite)
   CODE_INFOGRAPHIC → código (SVG/PNG) sin IA de texto inventado
        │
        ▼
 Validation → Retry (slot fallido) → Pack + costos
        │
        ▼
 Approval UI → selected URLs → generate-csv Item photo URL
        │
        ▼
 Cost Dashboard + budget gate + pack/job cache metrics (Fase 9)
```

**Cola:** Fase 1–9 sync con estados en DB + `creative_jobs`; full queue / Inngest sigue opcional.

---

## 3–9. (sin cambios estructurales)

Tipos, proveedores, endpoints, costos y riesgos del plan original se mantienen. Infografías: `$0` Sharp/pngjs local; solo hechos `status === "confirmed"` del Truth.  
QA (Fase 7): scores técnicos / fidelidad (phash) / composición / marketplace → PASS | RETRY | NEEDS_REVIEW | REJECT; retry capped por modo; `assertCreativePackExportable` + `GET .../export-ready`.  
eBay (Fase 8): `mergeItemPhotoUrlsForEbay` (creatives first + listing fillers) → official draft CSV `Item photo URL`; UI “Use creatives in draft CSV”; sin pack = export listing photos only.  
Costos (Fase 9): `creative_usage_events` + fingerprint/`input_fingerprint` + job idempotency cache hits; `checkCreativeBudgetGate` reusa `budget_settings`; dashboard en `/usage` + `GET /api/costs` (`creative`) + `GET /api/costs/creative`.

---

## 10. Plan por fases (puertas de aprobación)

| Fase | Entrega | Criterio de aceptación |
|------|---------|------------------------|
| **0** | Este documento + auditoría | Revisado por ti ✓ |
| **1** | Fundación | **DONE** |
| **2** | Comprensión | **DONE** |
| **3** | Estudio blanco | **DONE** |
| **4** | Planner | **DONE** |
| **5** | Generación | **DONE** — COMPOSITE / CONTROLLED_GEN + method router + selective regenerate, `creative-gen-v5` |
| **6** | Infografías | **DONE** — features / dimensions / defects CODE_INFOGRAPHIC, `creative-infographic-v6` |
| **7** | QA | **DONE** — scores + retry selectivo + human review; reject bloquea export, `creative-qa-v7`, `tests/creative-phase7.test.ts` |
| **8** | eBay | **DONE** — orden carrusel → CSV Item photo URL, `creative-ebay-v8`, `tests/creative-phase8.test.ts` |
| **9** | Costos | **DONE** — dashboard creativo + límites + cache packs, `creative-costs-v9`, `tests/creative-phase9.test.ts` |
| **10*** | Conversion Engine | **DONE** — AI Sales Studio brief + category blueprints + tiers, `creative-conversion-v10`, `tests/creative-conversion-v10.test.ts` |

\*v10 is a Conversion Engine upgrade on top of the closed DOCX plan — Truth/Safety/export gates unchanged.

---

## 10b. Conversion Engine / AI Sales Studio (v10)

**Philosophy:** don’t generate a boring slot checklist — design a **visual sales journey** so buyers fall in love in &lt;10 seconds.

| Piece | Location |
|-------|----------|
| Category story blueprints | `config/conversion-stories.ts` |
| Planner + brief | `lib/creative/conversion-engine.ts` + `lib/creative/planner.ts` |
| UI | `components/creative/creative-pack-panel.tsx` (Advanced → AI Sales Studio) |
| Pipeline | `CREATIVE_PIPELINE_VERSION = creative-conversion-v10` |

**Tiers (UI) ↔ pack modes (DB):** Basic→`economy`, Professional→`standard`, Premium→`premium`, Ultimate→`ultimate`.  
**Lift labels** are heuristics labeled “Estimate only” — not guaranteed A/B lifts.  
**Deferred:** true conversion analytics / A/B measurement.

---

## 11. Criterios globales de aceptación (módulo listo)

- Usuario sube fotos una vez → Generate Creative Pack → carrusel con estados.
- Nunca inventa trasera / unboxed / medidas / piezas.
- Cada asset: método, proveedor, costo, score, estado.
- Aprobar / regenerar / reemplazar / eliminar por imagen.
- Solo assets aprobados van al draft eBay.
- Costos visibles antes y después; cache evita reanalizar.
- Tests de Safety Engine (blocked vs allowed) en verde.
- Infografías renderizadas por código con datos verificados (Fase 6 ✓).
- QA auto + retry capped + reject bloquea export (Fase 7 ✓).
- Carrusel aprobado → Item photo URL en draft CSV oficial (Fase 8 ✓).
- Dashboard creativo + presupuesto + cache hits (Fase 9 ✓).

---

## 12. Decisión

Fases 0–9 quedan cerradas según el plan oficial. **v10 Conversion Engine / AI Sales Studio** layers storytelling blueprints and tiered briefs on the same Safety/Truth/export gates.

Mejoras posteriores (HEIC upload, upscale, cola asíncrona, true A/B conversion analytics) no están en el plan por fases — pedir aprobación explícita antes de implementarlas.
