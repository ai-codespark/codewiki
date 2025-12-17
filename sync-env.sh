#!/bin/bash
# Quick wrapper script for syncing environment variables
# Usage: ./sync-env.sh [--frontend-only | --backend-only]

set -e

echo "🔄 Syncing environment variables from .env.local to wrangler.toml..."
echo ""

python sync_env_to_wrangler.py "$@"

echo ""
echo "📋 Next steps:"
echo "1. Review the updated wrangler.toml files"
echo "2. Set any secrets shown above using wrangler CLI"
echo "3. Deploy your changes"
