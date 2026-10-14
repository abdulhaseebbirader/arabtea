# Arab Tea House — Deployment Guide

## Prerequisites

1. A **Google Sheet** for the shop with two tabs:

   | Tab        | Header row 1 (exact)                                                          |
   | ---------- | ---------------------------------------------------------------------------- |
   | `SALES`    | `DATE` `CASH` `ONLINE` `TOTAL`                                               |
   | `EXPENSES` | `DATE` `Milk` `Sugar` `Tea` `Bakery` `Cold Drinks` `Cigarettes` `Tobacco` `Gas` `Others` `TOTAL` |

   Copy the spreadsheet ID from its URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

2. The **Google Sheets connector** linked to the project (same mechanism as the
   original Lovable project), giving you `LOVABLE_API_KEY` and
   `GOOGLE_SHEETS_API_KEY`.

## Vercel environment variables

Project → Settings → Environment Variables (Production + Preview):

| Name                  | Value                                   |
| --------------------- | --------------------------------------- |
| `LOVABLE_API_KEY`     | `sk_...` gateway key (server-only)      |
| `GOOGLE_SHEETS_API_KEY` | `lovc_...` connection key             |
| `ARAB_SPREADSHEET_ID` | the shop spreadsheet ID                 |

## Deploy

```bash
vercel --prod
```

or import the GitHub repo in Vercel — the included `vercel.json` handles SPA
routing and PWA asset caching.

## Verify

1. Open the deployed URL.
2. Daily Collection → enter today's CASH and ONLINE → Save.
3. Check the `SALES` tab: a `DD/MM/YY` row appears with TOTAL = cash + online.
4. Daily Expenses → enter a few categories → Save.
5. Check the `EXPENSES` tab: row TOTAL is the sum of all categories.
