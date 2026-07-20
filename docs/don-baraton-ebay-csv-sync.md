# Don Baratón — Higlou CSV import contract

## Goal

When Higlou generates an eBay Seller Hub / Create Drafts CSV, the **same file**
is pushed to Don Baratón (`www.donbaraton.shop`) so Admin → Importar eBay logic
runs without a second manual upload.

Do **not** invent a new product JSON schema. The contract is the eBay CSV.

## Higlou → Don Baratón

| Item | Value |
|------|--------|
| Method | `POST` |
| Path | `/api/admin/import/ebay-csv` |
| Auth | `Authorization: Bearer <DON_BARATON_IMPORT_TOKEN>` |
| Body | `multipart/form-data` |
| Fields | `file` (CSV), `autoApply` (`true`), `source` (`higlou`) |

### Success response (200)

```json
{
  "ok": true,
  "batchId": "uuid",
  "summary": { "created": 1, "updated": 0, "skipped": 0, "errors": 0 },
  "message": "Applied"
}
```

### Error response

```json
{ "ok": false, "error": "…" }
```

## Higlou env

```env
DON_BARATON_API_URL=https://www.donbaraton.shop
DON_BARATON_IMPORT_TOKEN=shared-secret
DON_BARATON_SYNC_ENABLED=true
NEXT_PUBLIC_DON_BARATON_URL=https://www.donbaraton.shop
```

Legacy aliases still read: `DON_BARATON_URL`, `DON_BARATON_SYNC_TOKEN`.

## Don Baratón env

**Vercel project:** `don-baraton-front-en-d`  
**GitHub repo:** `D2LE2/Don-Baraton-Front-EnD-`  
**Production URL:** `https://www.donbaraton.shop`

```env
HIGLOU_IMPORT_TOKEN=same-shared-secret
SUPABASE_SERVICE_ROLE_KEY=required-for-service-import
# optional alias:
# DON_BARATON_IMPORT_TOKEN=same-shared-secret
```

Do **not** configure Higlou sync on fork projects (`don-baraton-front-en-d-i12y`, etc.).
Only `don-baraton-front-en-d` owns production + domain.

## Behavior

1. Higlou `POST /api/generate-csv` builds the CSV → returns download to the user.
2. Best-effort: same bytes POSTed to Don Baratón (`X-Higlou-DonBaraton-Sync` header).
3. Don Baratón parses with the same pipeline as `/admin/importar-ebay`, then applies.
4. SKU is the create/update key (idempotent).
5. Photos present → product `published` + classification `nuevo`.
6. If Don Baratón fails, eBay CSV download still succeeds; Higlou logs + optional retry via `POST /api/don-baraton/import`.

## TODO (Don Baratón)

- [x] Expose `POST /api/admin/import/ebay-csv` (token auth, service role).
- [ ] Deploy token to production + set matching secrets on Higlou (Vercel).
- [ ] Confirm leaf category seed covers Higlou Category IDs before bulk sync.
