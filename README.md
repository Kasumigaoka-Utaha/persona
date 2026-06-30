# 用户实时陪审团 Demo

一个 **React + Vite 前端** 和 **FastAPI + SQLite 后端** 的 Demo，用于模拟 PM 在飞书文档中撰写 PRD 时，从右侧“陪审团”入口发起多用户群行为判断与 CTR / UV / PV 风险评级。

## 项目结构

- `frontend/`: React + Vite + TypeScript 前端
- `backend/`: FastAPI + SQLite 后端
- `用户实时陪审团_PRD_副本.md`: 默认 Demo 文档

---

## 1. 本地启动（最快）

### Step 1: 启动后端

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

编辑 `backend/.env`，至少补充：

```bash
PMS_AI_PROVIDER=deepseek
PMS_DEEPSEEK_API_KEY=your_deepseek_key
PMS_DEEPSEEK_MODEL=deepseek-v4-flash
```

You can switch the backend AI provider by changing `PMS_AI_PROVIDER` and restarting the backend.
The UI can also choose a model per analysis job: `deepseek`, `gemini`, or `gpt`. That per-job choice overrides `PMS_AI_PROVIDER`; the provider API key still must be configured in the backend environment.

DeepSeek example:

```bash
PMS_AI_PROVIDER=deepseek
PMS_DEEPSEEK_API_KEY=your_deepseek_key
PMS_DEEPSEEK_BASE_URL=https://api.deepseek.com
PMS_DEEPSEEK_MODEL=deepseek-v4-flash
```

Doubao / Volcengine Ark example:

```bash
PMS_AI_PROVIDER=doubao
PMS_DOUBAO_API_KEY=your_ark_api_key
PMS_DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
PMS_DOUBAO_MODEL=your_doubao_or_ark_endpoint_model
```

Gemini example:

```bash
PMS_AI_PROVIDER=gemini
PMS_GEMINI_API_KEY=your_gemini_api_key
PMS_GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
PMS_GEMINI_MODEL=gemini-2.5-flash
```

OpenAI-compatible example:

```bash
PMS_AI_PROVIDER=openai
PMS_OPENAI_API_KEY=your_openai_key
PMS_OPENAI_BASE_URL=https://api.openai.com/v1
PMS_OPENAI_MODEL=gpt-4.1-mini
```

启动后端：

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端默认行为：

- API 地址：`http://localhost:8000/api`
- SQLite 文件：`backend/user_realtime_jury.db`
- 生成/临时存储目录：`backend/storage/`

### Step 2: 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认前端地址：

- `http://localhost:5173`

前端默认会请求：

- `http://localhost:8000/api`

如果后端不在这个地址，启动前可设置：

```bash
VITE_API_BASE_URL=http://your-backend-host/api npm run dev
```

### Step 3: 打开 Demo

浏览器打开：

```text
http://localhost:5173
```

你会看到：

1. 左侧 mock Feishu 文档区
2. 右侧“陪审团”面板
3. 用户群选择
4. “开始审判 / 生成报告”按钮
5. 报告页 `/analysis/:jobId`

---

## 2. 本地生产模式验证

### Step 1: 构建前端

```bash
cd frontend
npm install
npm run build
npm run preview
```

### Step 2: 用生产参数启动后端

```bash
cd backend
. .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 3. 对外公开部署：推荐架构

推荐拆成两部分：

- **前端部署到 Vercel**
- **后端部署到 Render**（或任意长期运行的 Python 主机）

原因很简单：

- 前端是标准 Vite 静态站点，适合部署到 Vercel
- 当前后端依赖 **SQLite 本地文件** 和本地存储目录，更适合放在支持长期运行与持久磁盘的服务上

---

## 4. 公开部署方案 A（推荐）：前端上 Vercel，后端上 Render

### Part A: 部署后端到 Render

#### Step 1: 推送代码到 GitHub

把整个仓库推到 GitHub。

#### Step 2: 在 Render 创建 Web Service

在 Render 控制台创建一个新的 **Web Service**，指向这个仓库。

建议配置：

- **Root Directory**: `backend`
- **Environment**: `Python`
- **Build Command**:

```bash
pip install -r requirements.txt
```

- **Start Command**:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

#### Step 3: 配置环境变量

至少配置：

```bash
PMS_AI_PROVIDER=deepseek
PMS_DEEPSEEK_API_KEY=your_deepseek_key
PMS_DEEPSEEK_MODEL=deepseek-v4-flash
```

如果你准备继续使用 SQLite，请额外配置：

```bash
PMS_DATABASE_URL=sqlite:////var/data/user_realtime_jury.db
PMS_STORAGE_DIR=/var/data/storage
```

#### Step 4: 给 Render 挂持久磁盘

在 Render 给后端服务添加 **Persistent Disk**，挂载路径建议：

```text
/var/data
```

这样：

- SQLite 文件会持久保存
- `storage/` 里的内容也不会因为重启/重新部署而丢失

#### Step 5: 记下后端公网地址

部署成功后，拿到类似：

```text
https://your-backend.onrender.com
```

后续前端会用到：

```text
https://your-backend.onrender.com/api
```

---

### Part B: 部署前端到 Vercel

#### Step 1: 导入 GitHub 仓库

在 Vercel 中点击 **New Project**，选择你的仓库。

#### Step 2: 设置 Frontend Root Directory

因为前后端在同一个仓库里，Vercel 项目建议配置：

- **Root Directory**: `frontend`

#### Step 3: 配置环境变量

在 Vercel 项目里添加：

```bash
VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

#### Step 4: 构建配置

通常可使用：

- **Install Command**: `npm install`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

#### Step 5: 确认 SPA 路由重写

这个项目使用 React Router，公开部署时需要把非静态资源路径重写到 `index.html`。

仓库中已经提供：

- `frontend/vercel.json`

它会把 `/analysis/:jobId` 这类前端路由正确交给前端应用处理。

#### Step 6: 部署

点击 **Deploy**。

部署完成后，你会得到类似：

```text
https://your-frontend.vercel.app
```

---

## 5. 公开部署方案 B：单机 / 云服务器部署

如果你不想拆成 Vercel + Render，也可以用一台 Linux 主机直接部署。

### Step 1: 安装运行时

在服务器安装：

- Python 3.11+
- Node.js 20+
- Nginx（可选但推荐）

### Step 2: 部署后端

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

编辑 `.env`：

```bash
PMS_AI_PROVIDER=doubao
PMS_DOUBAO_API_KEY=your_ark_api_key
PMS_DOUBAO_MODEL=your_doubao_or_ark_endpoint_model
```

启动：

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

更推荐使用 `systemd` / `supervisor` 守护。

### Step 3: 构建前端

```bash
cd frontend
npm install
VITE_API_BASE_URL=https://your-domain.com/api npm run build
```

### Step 4: 用 Nginx 托管前端

把 `frontend/dist/` 作为静态目录托管。

Nginx 需要保证 SPA 路由回退到 `index.html`，例如：

```nginx
location / {
  try_files $uri /index.html;
}
```

### Step 5: 反向代理后端

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8000/api/;
}
```

---

## 6. 为什么不建议把当前后端直接部署到 Vercel？

当前后端不适合直接上 Vercel 的主要原因：

1. 它依赖 **SQLite 本地数据库文件**
2. 它依赖本地 `storage/` 目录
3. 这类状态更适合放在持久磁盘或外部数据库中

如果未来你一定要把后端也放到 Vercel，需要先改造为：

- SQLite → PostgreSQL / MySQL / Neon / Supabase
- 本地文件 → S3 / R2 / OSS
- 后台任务 → 队列或外部 worker

---

## 7. 推荐的环境变量

### Backend

```bash
PMS_AI_PROVIDER=deepseek
PMS_DEEPSEEK_API_KEY=your_deepseek_key
PMS_DEEPSEEK_BASE_URL=https://api.deepseek.com
PMS_DEEPSEEK_MODEL=deepseek-v4-flash

# or Doubao / Volcengine Ark
PMS_AI_PROVIDER=doubao
PMS_DOUBAO_API_KEY=your_ark_api_key
PMS_DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
PMS_DOUBAO_MODEL=your_doubao_or_ark_endpoint_model

# or Gemini
PMS_AI_PROVIDER=gemini
PMS_GEMINI_API_KEY=your_gemini_api_key
PMS_GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
PMS_GEMINI_MODEL=gemini-2.5-flash

# or OpenAI-compatible
PMS_AI_PROVIDER=openai
PMS_OPENAI_API_KEY=your_openai_key
PMS_OPENAI_BASE_URL=https://api.openai.com/v1
PMS_OPENAI_MODEL=gpt-4.1-mini
```

可选：

```bash
PMS_DATABASE_URL=sqlite:////absolute/path/user_realtime_jury.db
PMS_STORAGE_DIR=/absolute/path/storage
```

### Frontend

```bash
VITE_API_BASE_URL=https://your-backend-host/api
```

---

## 8. 部署后检查清单

上线后建议依次检查：

1. 首页是否能正常加载
2. 是否能读取默认 Demo 文档
3. 是否能选择用户群
4. 是否能成功生成报告
5. `/analysis/:jobId` 刷新后是否仍可打开
6. Markdown 导出是否正常
7. 后端是否能正常访问 `/api/health`

---

## 9. 当前最推荐的上线方式

如果你只是要把 Demo 尽快公开给同事或面试/答辩使用：

- **前端：Vercel**
- **后端：Render**
- **数据库：先保留 SQLite + Render Persistent Disk**

如果你后面要长期稳定公开使用，再升级为：

- **前端：Vercel**
- **后端：Render / Railway / Fly.io / 云主机**
- **数据库：PostgreSQL**
- **文件存储：对象存储**
