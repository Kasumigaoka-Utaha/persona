# Frontend

## Run locally

```bash
npm install
npm run dev
```

If backend is not on the default address:

```bash
VITE_API_BASE_URL=http://localhost:8000/api npm run dev
```

## Public deploy on Vercel

- Root Directory: `frontend`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Env:

```bash
VITE_API_BASE_URL=https://your-backend-host/api
```

This repo also includes `frontend/vercel.json` for SPA route rewrites.
