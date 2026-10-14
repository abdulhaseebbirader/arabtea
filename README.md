# Arab Tea House — Daily Reconciliation

A mobile-first Progressive Web App (PWA) for a tea shop to log daily money
collected (cash + online) against daily expenses, writing straight into a
Google Sheet — the spreadsheet **is** the database.

## What it does

- **Daily Collection** — one form per day: CASH + ONLINE. The app computes
  TOTAL and writes the row to the `SALES` tab.
- **Daily Expenses** — one form per day across the expense categories
  (Milk, Sugar, Tea, Bakery, Cold Drinks, Cigarettes, Tobacco, Gas, Others).
  Row TOTAL is auto-computed and written to the `EXPENSES` tab.
- **Cycle overview** — per calendar month: total collections, total expenses,
  net (collections − expenses), cash/online split, days logged.
- **History & inline edit** — tap any past date to correct it; the sheet row
  is updated in place.
- **Expense category management** — add, rename, or archive columns without
  touching historical data.
- **Offline-first** — entries queue locally and sync when connectivity returns.
- **Monthly rollover** — the first save of a new month appends a bold yellow
  `TOTAL <start>-<end>` summary row for the previous month.

## Google Sheet layout

One Google Spreadsheet, two tabs (create them exactly like this):

| Tab        | Header row 1                                                                  |
| ---------- | ----------------------------------------------------------------------------- |
| `SALES`    | `DATE` `CASH` `ONLINE` `TOTAL`                                                |
| `EXPENSES` | `DATE` `Milk` `Sugar` `Tea` `Bakery` `Cold Drinks` `Cigarettes` `Tobacco` `Gas` `Others` `TOTAL` |

Dates are stored as `DD/MM/YY` text.

## Tech stack

React 19 + TanStack Start/Router + Tailwind 4 + React Query. Google Sheets
writes go through server functions (`src/lib/sheets.functions.ts`) calling the
Lovable connector gateway (`src/lib/sheets.server.ts`) — credentials never
reach the browser.

## Environment variables

Copy `.env.example`. You need:

- `LOVABLE_API_KEY` — Lovable connector gateway key (server-only)
- `GOOGLE_SHEETS_API_KEY` — encrypted key for the linked Google Sheets account
- `ARAB_SPREADSHEET_ID` — the Google Sheet's ID (from its URL)

## Develop

```sh
npm i
cp .env.example .env   # fill in real values
set -a && . ./.env && set +a
npm run dev            # http://localhost:8080
```

Checks: `npm run test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Deploy to Vercel

See `VERCEL_DEPLOY.md` / `DEPLOYMENT.md`. Push to `main`, import the repo in
Vercel, set the three env vars, done.
