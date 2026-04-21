# USDA FoodData Central setup

This app is a **static client app** (no backend). That has two important implications:

1. Any `VITE_*` environment variable is **embedded into the built JS bundle** and is **publicly visible** at runtime.
2. We **do not** commit keys to git, but we **do** support injecting a key at build time so USDA search works by default.

## Key resolution order

The USDA client chooses the API key in this order:

1. `import.meta.env.VITE_USDA_API_KEY` (preferred)
2. `import.meta.env.VITE_FDC_API_KEY` (legacy alias)
3. Settings → **API Key (optional override)** (stored locally in IndexedDB)

If none are present, USDA search UI stays usable and shows an inline message.

## Local development

1. Get a free key from USDA:
   - https://fdc.nal.usda.gov/data-key-access.html

2. Create `.env.local` in the project root (this file is gitignored):

```bash
VITE_USDA_API_KEY=YOUR_KEY_HERE
```

3. Start dev server:

```bash
npm run dev
```

## GitHub Pages (recommended)

### 1) Add a repo secret

In your repo:

- Settings → Secrets and variables → Actions → **New repository secret**
- Name: `VITE_USDA_API_KEY`
- Value: your USDA key

### 2) Pass secret into the build job

Update `.github/workflows/deploy.yml` build step to include:

```yaml
env:
  VITE_USDA_API_KEY: ${{ secrets.VITE_USDA_API_KEY }}
```

Because this is a static app, the key will be visible in the deployed JS bundle.
Treat it as **non-secret**.

## Troubleshooting

- If you see "USDA API key not configured":
  - Make sure `VITE_USDA_API_KEY` is set at build time OR you entered an override in Settings.
- If you see rate limiting:
  - USDA enforces request limits. The app uses caching + AbortController to reduce spam.
