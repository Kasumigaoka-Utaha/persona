# Backend

## Run locally

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Default paths

- SQLite: `backend/user_realtime_jury.db`
- Storage: `backend/storage/`

## Required env

```bash
PMS_OPENAI_API_KEY=
PMS_OPENAI_BASE_URL=https://api.openai.com/v1
PMS_DEFAULT_MODEL=gpt-4.1-mini
```

## Public deploy

Recommended:

- deploy this backend to Render
- if using SQLite, mount a persistent disk and point:

```bash
PMS_DATABASE_URL=sqlite:////var/data/user_realtime_jury.db
PMS_STORAGE_DIR=/var/data/storage
```
