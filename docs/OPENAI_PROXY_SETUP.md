# OpenAI Proxy + Voice (Secure) Setup

This app is a static frontend (GitHub Pages) and **must not** ship your OpenAI API key to the browser.

So we use a tiny backend proxy (Cloudflare Worker) that:
- holds `OPENAI_API_KEY` as a Worker secret
- exposes 3 endpoints used by the app:
  - `POST /api/ai/chat` (chat + tool calling)
  - `POST /api/ai/transcribe` (speech → text)
  - `POST /api/ai/speak` (text → speech)

When the proxy returns a quota/billing error, the app automatically **falls back** to local providers (WebLLM/deterministic).

## 1) Deploy the proxy worker (Cloudflare)

### Prereqs
- Cloudflare account
- `wrangler` installed

```bash
npm i -g wrangler
wrangler login
```

### Deploy
```bash
cd server/ai-proxy-worker

# First time only:
wrangler secret put OPENAI_API_KEY
# paste your OpenAI key when prompted

wrangler deploy
```

Wrangler will print a URL like:
```
https://fitbud-ai-proxy.<your-subdomain>.workers.dev
```

That URL is your `VITE_AI_PROXY_BASE_URL`.

### (Optional) Lock down CORS
Edit `server/ai-proxy-worker/wrangler.toml` and set:
```toml
[vars]
CORS_ORIGIN = "https://<your-gh-pages-domain>"
```
Then redeploy:
```bash
wrangler deploy
```

## 2) Configure the frontend

### Local development
Create `.env.local` in the project root:
```bash
VITE_AI_PROXY_BASE_URL=https://fitbud-ai-proxy.<your-subdomain>.workers.dev
VITE_OPENAI_MODEL_ID=gpt-5.2
```

Restart `npm run dev`.

### GitHub Actions (Pages build)
In your GitHub repo:
- Settings → Secrets and variables → Actions → **New repository secret**

Add:
- `VITE_AI_PROXY_BASE_URL` = your Worker URL
- (optional) `VITE_OPENAI_MODEL_ID` = `gpt-5.2`

Then update workflow env if needed (see `.github/workflows/deploy.yml`).

## 3) Enable it in-app
1. Open **Settings**
2. Set **AI Assistant Provider** → **OpenAI Coach (via secure proxy)**
3. Turn on **Allow assistant logging actions** (so it can log food/workouts/weight)

## 4) Voice chat
Voice uses the same proxy:
- mic recording in browser
- uploads audio to `/api/ai/transcribe`
- assistant response is spoken via `/api/ai/speak`

If OpenAI quota is exceeded, voice actions will fail gracefully and you can still type (fallback provider).

## Notes / Safety
- Your OpenAI key stays only in Cloudflare Worker secrets.
- Static frontend only sees the proxy URL.
- The assistant tools are constrained to safe app actions (log food/workout/weight, create drafts, navigation).
