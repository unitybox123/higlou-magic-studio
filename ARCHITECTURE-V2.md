# Higlou Architecture v2 — Phase A

Higlou is a **decision system**, not a chain of blind paid API calls: validate images, reuse cache, gather evidence, then spend only when needed.

## Pipeline order (enforced)

```
Upload
  → Image Quality Gate          (local, free)
  → Product Fingerprint / Cache (free)
      ├─ hit  → load saved analysis ($0 paid)
      └─ miss → Barcode (local)
               → OCR selective (paid if Vision on)
               → OpenAI multimodal (paid, fewest images)
               → Fusion
               → Confidence Policy
               → Category + Item Specifics
               → HTML (client; branding-only regen allowed)
               → Validation
               → Save normalized product + cache
               → Generate eBay CSV
               → Optional: publish same listing to Don Baraton marketplace
```

Higlou scope: **analyze product photos → perfect CSV for eBay + marketplace**.
Creative / campaign image generation is out of scope (removed).

## Phase A modules

| Module | Path | Role |
|--------|------|------|
| Quality Engine | `lib/images/quality-engine.ts` | Block/exclude bad photos before paid APIs |
| Fingerprint | `lib/cache/product-fingerprint.ts` | `sha256(sorted hashes + pipeline + prompt + mode)` |
| Analysis cache | `lib/cache/analysis-cache.ts` | Image bundle + product-level cache |
| Confidence | `lib/ai/confidence-engine.ts` | ≥80 confirmed, 60–79 review, &lt;60 empty |
| Cost optimizer | `lib/ai/cost-optimizer.ts` | Decide barcode/OCR/OpenAI image counts |
| Normalized product | `types/normalized-product.ts` | Marketplace-agnostic product JSON |
| Orchestrator | `lib/ai/analyze-product.ts` | Wires the full Phase A flow |

## Confidence policy

- User-entered values → confidence `1.0` / confirmed  
- Valid barcode UPC → ~0.98  
- OpenAI-only identity (brand/model/UPC/MPN) → capped, often `review`  
- Confidence &lt; 0.6 → value emptied (never invent)  
- UI: semaphore via `ConfidenceBadge` (percent on hover)

## Cache versions

Bump to invalidate all product fingerprints:

- `PIPELINE_VERSION` = `higlou-pipeline-v2a`
- `PROMPT_VERSION` = `higlou-prompt-v2a`

SQL: `supabase/migrations/20260714_product_analysis_cache.sql`

## Cost optimizer rules (v1)

1. Always prefer local barcode on usable images  
2. Valid UPC → fewer OCR + OpenAI images  
3. Strong OCR text → economy OpenAI, fewer images  
4. **Do not** skip OpenAI solely because OCR found text  
5. Advanced only via auto-escalation or explicit user action (`Deep Analysis` / `forceFreshAnalysis`)

## APIs

| Endpoint | Purpose |
|----------|---------|
| `POST /api/images/quality-check` | Quality gate only |
| `POST /api/analysis/plan` | Cost plan preview |
| `POST /api/analyze-product` | Full orchestrator (`forceFreshAnalysis` supported) |
| `GET /api/analysis/cache/:fingerprint` | Cache lookup |

## UI states

Checking images → Checking cache → Analyzing evidence → Preparing eBay draft → Ready

Advanced actions: Improve Labels, Deep Analysis, **Run Fresh Analysis** (bypass cache).

## Metrics to track (DoD)

- `cache_hit_rate`
- `average_cost_per_product`
- `openai_calls_per_product` / `vision_calls_per_product`
- `images_sent_to_openai`
- Quality blocks before spend (target 100% of unusable sets)

## Phase B modules (condition, package, specifics)

| Module | Path | Role |
|--------|------|------|
| Condition Analyzer | `lib/ai/condition-analyzer.ts` | Defects, notes, honest conditionId |
| Package contents | `lib/ai/package-contents.ts` | Includes + missing accessories |
| Item specifics builder | `lib/ai/item-specifics-builder.ts` | C:* for resolved category family |

Pipeline versions: `higlou-pipeline-v2b` / `higlou-prompt-v2b`.

## Applying migrations

Run `20260714_product_analysis_cache.sql` on your Supabase project so product fingerprint cache works for authenticated users. Without it, analysis still runs; product-level cache just no-ops.
