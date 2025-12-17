# DeepWiki Cloudflare Deployment Guide

This guide explains how to deploy the DeepWiki frontend on Cloudflare Pages and the backend as a Cloudflare Worker.

## Prerequisites

- Cloudflare account
- Node.js 18+ and npm/yarn
- Python 3.12+ (for backend)
- Cloudflare API Token with Pages and Workers permissions

## Architecture

- **Frontend**: Next.js app deployed on Cloudflare Pages (edge runtime)
- **Backend**: FastAPI Python server (to be deployed separately on Cloudflare Workers or other infrastructure)

## Frontend Deployment (Cloudflare Pages)

### Step 1: Install Dependencies

```bash
npm install
# or
yarn install
```

### Step 2: Build for Cloudflare Pages

```bash
# Standard Next.js build
npm run build

# Build for Cloudflare Pages
npx @cloudflare/next-on-pages
```

This creates a `.vercel/output/static` directory optimized for Cloudflare's edge runtime.

### Step 3: Configure Cloudflare Credentials

Get your Cloudflare Account ID:
```bash
npx wrangler whoami
```

Set environment variables:
```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id-here"
export CLOUDFLARE_API_TOKEN="your-api-token-here"
```

### Step 4: Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy .vercel/output/static --project-name codewiki
```

### Step 5: Configure Environment Variables

In Cloudflare Dashboard → Pages → codewiki → Settings → Environment Variables, add:

```
SERVER_BASE_URL=https://your-backend-api-url.com
GOOGLE_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
AZURE_OPENAI_API_KEY=your_azure_openai_api_key (optional)
AZURE_OPENAI_ENDPOINT=your_azure_openai_endpoint (optional)
AZURE_OPENAI_VERSION=your_azure_openai_version (optional)
OPENROUTER_API_KEY=your_openrouter_api_key (optional)
OLLAMA_HOST=your_ollama_host (optional, defaults to http://localhost:11434)
DEEPWIKI_EMBEDDER_TYPE=google (optional, defaults to openai)
```

## Backend Deployment Options

The Python backend (`api/` folder) needs to be deployed separately. Choose one of these options:

### Option 1: Cloudflare Workers (Python Workers)

**Note**: Cloudflare Workers for Python is in beta. For production, consider Option 2 or 3.

1. Install dependencies:
```bash
cd api
pip install -r requirements.txt
```

2. Create a Worker-compatible entry point
3. Deploy using Wrangler

### Option 2: Traditional Cloud Services

Deploy the FastAPI backend to:
- **Google Cloud Run**
- **AWS Lambda** (with API Gateway)
- **Azure Functions**
- **Heroku**
- **DigitalOcean App Platform**
- **Railway**
- **Fly.io**

Example for Cloud Run:
```bash
# Build container
docker build -f Dockerfile -t deepwiki-backend .

# Deploy to Cloud Run
gcloud run deploy deepwiki-backend \
  --image gcr.io/your-project/deepwiki-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Option 3: Self-Hosted

Run the backend on your own infrastructure:

```bash
cd api
python -m pip install poetry==1.8.2 && poetry install
python -m api.main
```

Ensure the server is accessible at a public URL and update `SERVER_BASE_URL` in your Pages deployment.

## Configuration Files

### wrangler.toml

```toml
# Cloudflare Pages config for CodeWiki frontend
name = "codewiki"

# Pages deployment configuration
pages_build_output_dir = ".vercel/output/static"

# Environment variables
[vars]
NODE_VERSION = "20"
```

### .vercelignore

Excludes Python backend from frontend build:

```
# Ignore Python backend - it's deployed separately
api/
*.py
pyproject.toml
poetry.lock
uv.lock
pytest.ini
```

## Key Implementation Details

### Edge Runtime Support

All routes use Cloudflare's edge runtime:

- **API Routes**: Added `export const runtime = 'edge';` to all `/api/*` routes
- **Dynamic Pages**: Created layout files with edge runtime for dynamic routes like `/[owner]/[repo]`

### Client-Side Only Packages

Packages like `mermaid` and `svg-pan-zoom` are dynamically imported client-side only to avoid server-side rendering issues:

```typescript
// Dynamic import in useEffect
const mermaid = (await import('mermaid')).default;
```

### Next.js Configuration

The [next.config.ts](next.config.ts) excludes problematic packages from server bundle:

```typescript
experimental: {
  optimizePackageImports: ['react-syntax-highlighter'],
},
webpack: (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
  }
  return config;
}
```

## Troubleshooting

### Build Errors

**Error**: `self is not defined`
- **Solution**: Ensure mermaid is dynamically imported only on client-side

**Error**: Routes not configured for Edge Runtime
- **Solution**: Add `export const runtime = 'edge';` to all dynamic routes or their layout files

**Error**: Python files detected as API routes
- **Solution**: Ensure `.vercelignore` excludes the `api/` folder

### Deployment Issues

**Error**: Invalid account ID
- **Solution**: Use the hex account ID from `npx wrangler whoami`, not your username

**Error**: Missing environment variables
- **Solution**: Configure all required env vars in Cloudflare Pages settings

## Local Development

For local development with hot reload:

```bash
# Terminal 1: Backend
cd api
python -m api.main

# Terminal 2: Frontend
npm run dev
```

Access the app at `http://localhost:3000`

## Production Checklist

- [ ] Frontend deployed to Cloudflare Pages
- [ ] Backend deployed and accessible
- [ ] `SERVER_BASE_URL` points to backend
- [ ] All API keys configured in Pages environment variables
- [ ] Custom domain configured (optional)
- [ ] HTTPS enabled (automatic on Cloudflare)
- [ ] Test all features: wiki generation, chat, diagrams

## Useful Commands

```bash
# Build for Cloudflare
npx @cloudflare/next-on-pages

# Deploy to Pages
npx wrangler pages deploy .vercel/output/static --project-name codewiki

# Check Wrangler status
npx wrangler whoami

# View deployment logs
npx wrangler pages deployment list --project-name codewiki

# Clean build artifacts
rm -rf .next .vercel
```

## Support

For issues or questions:
- [DeepWiki GitHub Issues](https://github.com/AsyncFuncAI/deepwiki-open/issues)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
