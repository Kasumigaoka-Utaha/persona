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

## AI model provider env

```bash
PMS_AI_PROVIDER=deepseek
PMS_DEEPSEEK_API_KEY=your_deepseek_key
PMS_DEEPSEEK_BASE_URL=https://api.deepseek.com
PMS_DEEPSEEK_MODEL=deepseek-v4-flash
```

Switch providers by changing `PMS_AI_PROVIDER` and restarting the backend.

Doubao / Volcengine Ark:

```bash
PMS_AI_PROVIDER=doubao
PMS_DOUBAO_API_KEY=your_ark_api_key
PMS_DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
PMS_DOUBAO_MODEL=your_doubao_or_ark_endpoint_model
```

OpenAI-compatible:

```bash
PMS_AI_PROVIDER=openai
PMS_OPENAI_API_KEY=your_openai_key
PMS_OPENAI_BASE_URL=https://api.openai.com/v1
PMS_OPENAI_MODEL=gpt-4.1-mini
```

`PMS_DEFAULT_MODEL` is still accepted as a backward-compatible fallback for OpenAI.

## Public deploy

Recommended:

- deploy this backend to Render
- if using SQLite, mount a persistent disk and point:

```bash
PMS_DATABASE_URL=sqlite:////var/data/user_realtime_jury.db
PMS_STORAGE_DIR=/var/data/storage
```
