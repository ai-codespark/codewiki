#!/bin/bash
# 检查并重新部署 Cloudflare 前端服务
set -e

echo "🔍 检查 Cloudflare Workers 列表..."
wrangler info --name codewiki || true
echo
echo "🔍 检查 Cloudflare Workers Service 列表..."
wrangler info --name codewiki-service || true

echo
echo "🚀 强制重新部署前端 Worker (codewiki)..."
cd "$(dirname "$0")"

# 清理旧构建缓存
echo "🧹 清理构建缓存..."
rm -rf .next .vercel

# 重新构建前端
echo "📦 重新构建前端..."
NODE_VER=$(node -v 2>/dev/null | sed 's/^v//')
NODE_MAJOR=${NODE_VER%%.*}
if [ -n "$NODE_MAJOR" ] && [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ 当前 Node.js 版本为 v$NODE_VER，需升级到 v20+"
  echo "🔧 使用 nvm 安装并切换到 v20： nvm install 20 && nvm use 20"
  exit 1
fi

# 仅使用 Cloudflare Next-on-Pages 构建
npm run build:pages || { echo "❌ 构建失败，请在 PowerShell 或 WSL/Linux/macOS 运行 npm run build:pages"; exit 1; }

# 强制重新部署前端 Worker
echo "🚀 部署前端 Pages (codewiki)..."
wrangler pages project list | grep -q "codewiki" || wrangler pages project create codewiki >/dev/null 2>&1 || true
wrangler pages deploy ".vercel/output/static" --project-name codewiki

echo "✅ 前端 Worker (codewiki) 重新部署完成"
echo "🌐 请访问 https://codewiki.pages.dev 查看最新版本"
