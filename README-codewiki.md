# DeepWiki Cloudflare Deployment Guide

This guide explains how to deploy the DeepWiki frontend on Cloudflare Pages and the backend as a Cloudflare Worker.

## Quick Links

- 📝 [Environment Variables Sync Guide](ENVIRONMENT_SYNC.md) - Automate `.env.local` to `wrangler.toml` sync
- 🚀 [Frontend Deployment](#frontend-deployment-cloudflare-pages)
- 🔧 [Backend Deployment Options](#backend-deployment-options)
- 📋 [Quick Reference](#quick-reference) - Command cheat sheet

## Quick Start with Make

For convenience, use the provided Makefile:

```bash
# Show all available commands
make help

# Sync environment variables
make sync-env

# Build and deploy frontend
make deploy-frontend

# Deploy backend
make deploy-backend

# Deploy everything
make deploy-all
```

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

First, sync your environment variables (optional but recommended):

```bash
# Option 1: Sync public vars only (recommended for security)
python sync_env_to_wrangler.py --frontend-only

# Then set secret keys via CLI
wrangler secret put GOOGLE_API_KEY
wrangler secret put OPENAI_API_KEY
# ... add other secrets as needed

# Option 2: Sync all variables at once
python sync_env_to_wrangler.py --all-vars --frontend-only

# Option 3: Sync with secrets section for reference
python sync_env_to_wrangler.py --include-secrets --frontend-only
```

Then deploy:

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

**Note**: Cloudflare Workers for Python is in beta. For production workloads, ensure you test thoroughly or consider Option 2 or 3.

#### Prerequisites

- Wrangler CLI installed: `npm install -g wrangler`
- Cloudflare account with Workers enabled
- Python 3.11+ installed locally

#### Step 1: Configure Environment Variables

Sync environment variables from `.env.local` to backend config:

```bash
# Option 1: Sync public vars only (recommended)
python sync_env_to_wrangler.py --backend-only

# Then set your API keys as secrets (encrypted, not in code)
cd api
wrangler secret put GOOGLE_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put AZURE_OPENAI_API_KEY        # optional
wrangler secret put AZURE_OPENAI_ENDPOINT       # optional
wrangler secret put AZURE_OPENAI_VERSION        # optional
wrangler secret put OPENROUTER_API_KEY          # optional
wrangler secret put LITELLM_API_KEY             # optional
wrangler secret put OLLAMA_HOST                 # optional

# Option 2: Sync all variables at once
python sync_env_to_wrangler.py --all-vars --backend-only

# Option 3: Include secrets section for reference
python sync_env_to_wrangler.py --include-secrets --backend-only
```

#### Step 2: Review Configuration

The `api/wrangler.toml` file is pre-configured for Workers deployment:

```toml
name = "deepwiki-backend"
main = "worker.py"
compatibility_date = "2024-01-01"

[python]
requirements = "requirements.txt"
```

You can customize the worker name or add custom domains if needed.

#### Step 3: Test Locally

Test the worker locally before deploying:

```bash
cd api
wrangler dev
```

This starts a local development server at `http://localhost:8787`

#### Step 4: Deploy to Cloudflare Workers

Deploy the backend:

```bash
cd api
wrangler deploy
```

After deployment, Wrangler will provide your Worker URL (e.g., `https://deepwiki-backend.your-subdomain.workers.dev`).

#### Step 5: Update Frontend Configuration

Update the `SERVER_BASE_URL` in your Cloudflare Pages environment variables to point to your Worker URL:

```
SERVER_BASE_URL=https://deepwiki-backend.your-subdomain.workers.dev
```

#### Important Notes

- **Python Workers Limitations**:
  - 50ms CPU time limit per request (can be increased with paid plans)
  - Some packages may not be compatible with the Workers runtime
  - Cold starts may take longer with many dependencies

- **Dependencies**: The `api/requirements.txt` is optimized for Workers deployment (excludes development-only packages like `adalflow` and `watchfiles`)

- **Entry Point**: The `api/worker.py` file serves as the Workers entry point, wrapping the FastAPI application

- **Monitoring**: View logs and metrics in the Cloudflare Dashboard → Workers & Pages → deepwiki-backend

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

### Environment Variables Sync

To simplify deployment, use the provided script to sync environment variables from `.env.local` to `wrangler.toml` files:

```bash
# Default: Sync public vars only (recommended for secrets)
python sync_env_to_wrangler.py

# Sync ALL variables including secrets to [vars] section
python sync_env_to_wrangler.py --all-vars

# Add [secrets] section with commented references
python sync_env_to_wrangler.py --include-secrets

# Combine with target selection
python sync_env_to_wrangler.py --all-vars --frontend-only
python sync_env_to_wrangler.py --include-secrets --backend-only
```

The script automatically:
- Reads all environment variables from `.env.local`
- Updates public variables in the `[vars]` section of wrangler.toml files
- Identifies secret keys (API keys, tokens) for secure handling
- Supports `--all-vars` to sync all variables including secrets
- Supports `--include-secrets` to add a [secrets] section with commented references
- Provides CLI commands to set secrets securely via `wrangler secret put`

**Important**: Secret keys (like `GOOGLE_API_KEY`, `OPENAI_API_KEY`) are never written to wrangler.toml. They must be set using:

```bash
# For frontend secrets
wrangler secret put GOOGLE_API_KEY

# For backend secrets
cd api
wrangler secret put GOOGLE_API_KEY
```

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

## Quick Reference

### Environment Variable Sync Commands

```bash
# Default: Sync public variables only
python sync_env_to_wrangler.py

# Sync ALL variables (including secrets)
python sync_env_to_wrangler.py --all-vars

# Add [secrets] section with commented references
python sync_env_to_wrangler.py --include-secrets

# Target specific deployment
python sync_env_to_wrangler.py --frontend-only
python sync_env_to_wrangler.py --backend-only

# Combine options
python sync_env_to_wrangler.py --all-vars --frontend-only
python sync_env_to_wrangler.py --include-secrets --backend-only

# Show help
python sync_env_to_wrangler.py --help

# Or use shell script
./sync-env.sh
```

### Secret Management

```bash
# Set frontend secrets
wrangler secret put <KEY_NAME>

# Set backend secrets
cd api && wrangler secret put <KEY_NAME>
```

### Auto-Detected Secret Variables

The following variables are automatically treated as secrets (not written to wrangler.toml):

- `GOOGLE_API_KEY`
- `OPENAI_API_KEY`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `OPENROUTER_API_KEY`
- `LITELLM_API_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Configuration Files

- **Source**: `.env.local` (local, not committed to Git)
- **Frontend Config**: `wrangler.toml`
- **Backend Config**: `api/wrangler.toml`
- **Example**: `.env.local.example`

### Typical Workflow

1. Edit `.env.local` with your configuration
2. Run `python sync_env_to_wrangler.py`
3. Set secrets: `wrangler secret put <KEY_NAME>` (for each secret)
4. Deploy your application

### Deployment Commands

```bash
# Frontend deployment
npx wrangler pages deploy .vercel/output/static --project-name codewiki

# Backend deployment
cd api && wrangler deploy
```

### Makefile Commands

```bash
make help              # Show all available commands
make sync-env          # Sync environment variables
make deploy-frontend   # Build and deploy frontend
make deploy-backend    # Deploy backend
make deploy-all        # Deploy everything
make dev-frontend      # Start frontend dev server
make dev-backend       # Start backend dev server
make secrets-help      # Show how to set secrets
```

### Build and Utility Commands

```bash
# Build for Cloudflare
npx @cloudflare/next-on-pages

# Check Wrangler status
npx wrangler whoami

# View deployment logs
npx wrangler pages deployment list --project-name codewiki

# Clean build artifacts
rm -rf .next .vercel
```

### Important Reminders

⚠️ **Security Best Practices:**
- Never commit `.env.local` to version control
- Secrets are set via CLI, not written to wrangler.toml
- Back up existing configuration before syncing
- Rotate API keys regularly

📚 **Additional Documentation:**
- [Environment Sync Guide](ENVIRONMENT_SYNC.md) - Complete guide
- [Feature Summary](ENV_SYNC_SUMMARY.md) - Overview of sync functionality

## Support

For issues or questions:
- [DeepWiki GitHub Issues](https://github.com/AsyncFuncAI/deepwiki-open/issues)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
