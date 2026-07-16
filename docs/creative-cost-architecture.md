# Creative cost architecture

Money safety over features. Designed after ~$6 USD was burned for fewer than 5 useful creatives.

## What was burning money

| Burn path | Why it cost $ |
|---|---|
| QA auto-retry under score 95 | Each failed pass fired another paid OpenAI / remove.bg call (2–4× per asset) |
| Provider cascade `remove_bg → openai` | remove.bg failure still billed OpenAI edit immediately |
| Multi-slot / Ideal Pack planning | Professional+ planned 8–12 beats; if unlocked, one click = many CONTROLLED_GEN |
| CONTROLLED_GEN with 1–3 refs | High-quality OpenAI `images.edit` × refs |
| Soft budget (`warn_only`) | Over-limit still allowed spend |
| Manual Regen spam | Uncapped explicit retries (still user-driven, but uncapped by pack) |

Listing **Analyze** (Vision/OpenAI text) is a **separate** invoice from Photo Studio. Studio does **not** re-call Vision for identity when Truth / `estimate_json.productIdentity` already exists.

## Rules now in force

1. **Analyze once** — Product Identity is reused from `pack.estimate_json.productIdentity`. Rebuild is local from Truth + sources (no OpenAI).
2. **User selects creatives** — Default CTA creates **only** Main photo (`cover_white`). No Professional 8–12 batch. API `/run` accepts **max 1 slot**.
3. **Sequential, cancelable, no auto-retry spend** — One image per click. After each: Approve / Try again / Create next / Stop. Auto paid retries **disabled**.
4. **Cheap path for white-bg** — Prefer `remove_bg` → `local_studio`. OpenAI edit only if `CREATIVE_ALLOW_OPENAI_STUDIO_FALLBACK=1`.
5. **One primary reference** — `CREATIVE_MAX_EXTRA_REFERENCES=0` (default). Never re-send the full set.
6. **Budget kill-switch** — Before each paid call: monthly remaining budget (`CREATIVE_BUDGET_HARD_STOP=1`) + per-pack `CREATIVE_MAX_PAID_CALLS_PER_PACK` (default 3). Events land in `creative_usage_events` with estimate vs actual.

## Cost model (approximate)

| Path | Typical USD | When |
|---|---|---|
| `local_studio` REAL_EDIT | $0 | Always available if allowed |
| `remove_bg` cutout + white composite | ~$0.05 (`REMOVE_BG_COST_USD`) | Best cheap Main photo |
| OpenAI white edit (opt-in fallback) | ~$0.04 (`OPENAI_IMAGE_EDIT_COST_USD`) | Only if fallback enabled |
| CONTROLLED_GEN lifestyle | ~$0.12+ (`OPENAI_IMAGE_GEN_COST_USD`) | **User opt-in** Ideal Pack Create Lifestyle (one click) when OpenAI key exists |

Default Photo Studio estimate for one Main photo: **~$0.03–0.05**.

## Env settings (cheapest safe path)

```bash
CREATIVE_STUDIO_PROVIDER=remove_bg   # or local_studio for $0
CREATIVE_ALLOW_OPENAI_STUDIO_FALLBACK=0
CREATIVE_ALLOW_LOCAL_STUDIO=true
CREATIVE_PHOTO_STUDIO_PHASE=2
CREATIVE_MAX_PAID_CALLS_PER_PACK=6
CREATIVE_BUDGET_HARD_STOP=1
CREATIVE_DISABLE_AUTO_PAID_RETRY=1
CREATIVE_MAX_EXTRA_REFERENCES=0
CREATIVE_QA_MAX_AUTO_RETRIES=1
CREATIVE_COMPOSITE_PROVIDER=local
OPENAI_IMAGE_MODEL=off              # optional hard disable of all OpenAI image spend
```

## How to use Photo Studio safely

1. Upload clear product photos and save the listing.
2. Click **Create main photo** once — expects remove.bg or local white studio.
3. Review the result. **Looks good** = approve. **Try again** = one explicit paid/local re-attempt (counts toward pack cap).
4. Ideal Pack cards unlock after Main is Ready: **Create Close-up** / **Create Packaging** / **Create Lifestyle** — one click each; Lifestyle shows est. cost.
5. **Stop here** — ends the session; no background generation.
6. Professional campaign wall (hero poster, 8–12 batch) stays locked.

## Code map

| Concern | File |
|---|---|
| Caps / UI copy | `config/creative-pack.ts` |
| Slot / pack call helpers | `lib/creative/cost-architecture.ts` |
| Auto-retry kill | `lib/creative/retry-controller.ts` |
| QA no longer returns paid RETRY | `lib/creative/qa.ts` |
| Cheap provider order | `lib/creative/providers/studio-router.ts` |
| One slot / one ref / identity reuse | `lib/creative/studio-service.ts` |
| Monthly kill-switch | `lib/costs/creative-gate.ts` |
| UI sequential CTAs | `components/creative/creative-pack-panel.tsx` |

## Disabled / gated paths

- Auto retry after QA &lt; 95 (paid)
- Identity auto-regen loops
- Multi-slot Ideal Pack run in one click
- remove.bg → OpenAI silent cascade (unless fallback env)
- CONTROLLED_GEN lifestyle in default Photo Studio phase 2
- API batch `slots` arrays longer than 1
