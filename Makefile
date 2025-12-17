.PHONY: help sync-env sync-frontend sync-backend deploy-frontend deploy-backend deploy-all

help: ## 显示帮助信息
	@echo "DeepWiki Cloudflare 部署助手"
	@echo ""
	@echo "可用命令:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

sync-env: ## 同步环境变量到 wrangler.toml (前端+后端)
	@echo "🔄 同步环境变量..."
	@python sync_env_to_wrangler.py

sync-frontend: ## 仅同步前端环境变量
	@echo "🔄 同步前端环境变量..."
	@python sync_env_to_wrangler.py --frontend-only

sync-backend: ## 仅同步后端环境变量
	@echo "🔄 同步后端环境变量..."
	@python sync_env_to_wrangler.py --backend-only

build-frontend: ## 构建前端 (Cloudflare Pages)
	@echo "🏗️  构建前端..."
	@npm run build
	@npx @cloudflare/next-on-pages

deploy-frontend: build-frontend ## 构建并部署前端到 Cloudflare Pages
	@echo "🚀 部署前端到 Cloudflare Pages..."
	@npx wrangler pages deploy .vercel/output/static --project-name codewiki

deploy-backend: ## 部署后端到 Cloudflare Workers
	@echo "🚀 部署后端到 Cloudflare Workers..."
	@cd api && wrangler deploy

deploy-all: deploy-frontend deploy-backend ## 部署前端和后端

dev-frontend: ## 启动前端开发服务器
	@echo "🔧 启动前端开发服务器..."
	@npm run dev

dev-backend: ## 启动后端开发服务器
	@echo "🔧 启动后端开发服务器..."
	@cd api && python -m api.main

secrets-help: ## 显示如何设置密钥
	@echo "🔐 设置 Cloudflare 密钥:"
	@echo ""
	@echo "前端密钥:"
	@echo "  wrangler secret put GOOGLE_API_KEY"
	@echo "  wrangler secret put OPENAI_API_KEY"
	@echo "  wrangler secret put LITELLM_API_KEY"
	@echo ""
	@echo "后端密钥:"
	@echo "  cd api && wrangler secret put GOOGLE_API_KEY"
	@echo "  cd api && wrangler secret put OPENAI_API_KEY"
	@echo "  cd api && wrangler secret put LITELLM_API_KEY"

clean: ## 清理构建文件
	@echo "🧹 清理构建文件..."
	@rm -rf .next .vercel node_modules/.cache
	@rm -rf api/__pycache__ api/**/__pycache__

install: ## 安装依赖
	@echo "📦 安装前端依赖..."
	@npm install
	@echo "📦 安装后端依赖..."
	@cd api && pip install -r requirements.txt
