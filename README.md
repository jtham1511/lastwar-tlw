# TLW Intel — TLW alliance (#2079)

A mobile-friendly **private scouting dashboard** inspired by the *features* shown in lastintel, with a distinct TLW design.

## What you get

| Feature | Demo | Live |
| --- | --- | --- |
| Commander/alliance index search | Fictional sample data | Public lastintel MCP `search_commanders_and_alliances` |
| Paid commander base locator | Clearly fictional sample coordinates | `run_targeting_job` with job `locate` (requires operator confirmation) |
| Secret task finder by reward/warzone | Fictional missions with filters | `run_targeting_job` with job `secret_task` (requires operator confirmation) |
| Coordinate sender to private game messages | Disabled | `send_coordinates` to **own verified account**, with confirmation |
| Tactical map | Demo samples + local coordinates | Local/user-supplied coordinates and ephemeral single-provider targeting results; **not a full live map** |
| CSV import / manual target list | Yes | Yes, local browser storage only |
| Alliance-wide shared target database | No | No — would require hosting/database/auth and permission for data licensing |

**Nothing in this project creates an independent live map scanner.** lastintel's documented `run_map_scan` MCP method only returns a delivery report, not the raw map rows. See [lastintel documentation](https://lastintel.io/mcp). This project does **not** scrape lastintel, access unauthorized game endpoints or collect game passwords.

## Instant demo

Open `TLW-Intel-Demo.html` in a web browser, select **Commander Locator** or **Secret Task Finder**, and search sample names. **Every demo commander, position and mission is fictional**, even when a coordinate is plausible.

This demo runs without a server. The live switch is disabled in the standalone file.

## Start locally (Node.js 20+)

1. Extract the project ZIP.
2. In a terminal, go to `tlw-intel`.
3. Run `npm start` (no package installation needed).
4. Open `http://localhost:3000`.
5. Use **Switch to live** for public index searches, or configure an API token for charged scans.

### Connect your personal lastintel API token

1. Sign in at [lastintel.io](https://lastintel.io).
2. Go to **Settings → API access** and create a token scoped for the actions you need (read, targeting jobs, optional coordinate sending).
3. Copy `.env.example` to `.env`.
4. Set `LASTINTEL_API_TOKEN=lwk_...` in `.env`. Never add the token to frontend files, GitHub or messages.
5. Run `npm run start:env` to load `.env` automatically, or configure your hosting environment variables and use `npm start`.
6. Optionally set `TLW_ACCESS_CODE` to a strong private passphrase, especially if accessible outside your PC.

In Settings (gear icon) within the dashboard, enter your **TLW private access code**, not the lastintel token. It is saved in `sessionStorage` for that browser tab only.

**IMPORTANT:** Do not deploy a public URL with a paid-scans token and no access protection. A public visitor could spend your credits. For real production use, replace the shared passphrase with named-member login and server-side permissions/quotas.

## Deploy to Vercel

This repository uses **vanilla JS + Node.js**, not React or a Next.js build; this avoids external dependencies.

1. Push this folder to your private GitHub repository.
2. Create a Vercel project from it. Choose Framework Preset **Other**. The `public/` folder contains static assets and `api/intel.js` is a Vercel serverless endpoint.
3. Add `LASTINTEL_API_TOKEN` and `TLW_ACCESS_CODE` to Vercel Environment Variables. For a live deployment, **you must use access protection**. If needed, use a Vercel-level access restriction as well.
4. Deploy and test the `health` endpoint and free index search before spending provider credits.
5. Keep the project private until the legal/licensing arrangements for wider TLW data sharing are settled.

Depending on your plan, paid targeting requests may take longer than the serverless function duration available. This has not been end-to-end tested with a live token.

## Actual credits and search behavior

Pricing and available options come from `get_account` / `list_targeting_jobs`; the frontend shows provider estimates. The provider determines actual charges. **Only the explicitly confirmed button** can call a credit-consuming tool. No scheduled scans or automatic repeated scans run. Sending coordinate pins is explicitly confirmed and limited to UIDs verified on the provider account.

Secret-task reward options are derived dynamically from the provider metadata where supported. If metadata does not expose exact codes, the app searches all rewards and lets the operator inspect the results. A failed or empty search does not guarantee there are no targets.

## Import coordinates

Use the map page's **Get CSV template** button. Header:

```csv
name,alliance,warzone,x,y,kind,reward,notes
```

Accepted `kind` values: `base`, `task`, `friendly`, `other`. CSV imports and manual targets remain in that browser's `localStorage` and are **not synchronized across TLW members or sent to the server**. The map works in one warzone at a time.

The map uses a generic coordinate grid, not Last War's proprietary world artwork. You cannot infer real-time shields, movement, plunderability or occupied/unoccupied status from manual data.

## Compliance and data attribution

- **Data: [lastintel.io](https://lastintel.io)** is displayed in the UI.
- The provider's [MCP developer/licensing page](https://lastintel.io/mcp) says that redistributing its data through your own product requires **prior written permission**. Contact `contact@lastintel.io` before distributing provider-sourced data to alliance members through this app. Don't re-serve scans in bulk.
- Honor provider limits, freshness, and caching. The dashboard does not export provider scan responses and does not persist them in the shared target list.
- The project is unofficial and has no affiliation with lastintel or the Last War publisher. Check the game's terms before connecting any other map/scanning source.
- Never provide your in-game account password, device session, or authentication capture files to this project.

## Tests

`npm test` validates warzone scope and the explicit confirmation requirement for paid operations.

## Next engineering steps

To operate it for TLW R4/R5 instead of one private operator, add identity-based login, a proper database and permissions, scan cost budgets, alliance activity audit, TTL/expiry for task results, and an authorized data distribution licence. All alliance-wide features must respect the source licensing and the game's terms.
