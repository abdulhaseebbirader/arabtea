# Vercel quick deploy — Arab Tea House

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repo (framework: Other/Vite,
   it auto-detects; `npm run build` and `dist` output work out of the box).
3. Set env vars (Production + Preview):

   | Name                    | Value                       |
   | ----------------------- | --------------------------- |
   | `LOVABLE_API_KEY`       | gateway key (`sk_...`)      |
   | `GOOGLE_SHEETS_API_KEY` | connection key (`lovc_...`) |
   | `ARAB_SPREADSHEET_ID`   | shop spreadsheet ID         |

4. Deploy. Every push to `main` redeploys automatically.

The Google Sheet must contain `SALES` and `EXPENSES` tabs — see README for the
exact header rows.
