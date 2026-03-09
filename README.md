# Austin Permit & Contractor Lookup

A Vercel-ready React + Vite app for searching City of Austin permit data.

## What it does

- Search by permit number, address, or contractor
- Filter by status and permit type
- Sort results
- Export CSV
- Open permit addresses in Google Maps
- Save recent searches and saved searches in local browser storage
- Store permit notes and tags in local browser storage
- Review a contractor dashboard grouped from the current filtered results

## Local development

1. Install Node.js 20 or newer.
2. In this folder, run:

```bash
npm install
npm run dev
```

3. Open the local URL shown in your terminal.

## Deploy to Vercel

1. Create a GitHub account if needed.
2. Create a new GitHub repository.
3. Upload all files from this project folder into that repository.
4. Create a Vercel account.
5. In Vercel, click **Add New...** then **Project**.
6. Import the GitHub repository.
7. Vercel should auto-detect **Vite**.
8. Click **Deploy**.

No environment variables are required for the current version.

## Notes

- This app uses public City of Austin endpoints only.
- Notes, tags, recent searches, and saved searches are stored locally in the browser of the device being used.
- If you want shared company-wide notes later, the next step would be adding a database and user logins.
