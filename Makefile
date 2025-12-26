.PHONY: help sync-env sync-frontend sync-backend deploy-frontend deploy-backend deploy-all

help: ## 显示帮助信息
	@echo "DeepWiki Cloudflare 部署助手"
	@echo ""
	@echo "可用命令:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

sync-env: ## 同步环境变量到 wrangler.toml (前端+后端)
	@echo "🔄 同步环境变量..."
	@python sync_env_to_wrangler.py --all-vars

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
	@bash -c 'if [ -f .env.local ]; then set -a; source .env.local; set +a; fi; npx wrangler pages deploy .vercel/output/static --project-name codewiki'

deploy-backend: ## ⚠️  部署后端到 Cloudflare Workers (不支持 - 请使用 Docker)
	@echo "⚠️  警告: Cloudflare Workers 不支持 FastAPI 和本项目所需的 Python 包"
	@echo "推荐使用 Docker 部署到 Cloud Run, Fly.io, 或 Railway"
	@echo ""
	@echo "如果仍要尝试 Workers 部署 (会失败):"
	@cd api && npx wrangler deploy

docker-build: ## 构建 Docker 镜像
	@echo "🐳 构建 Docker 镜像..."
	@docker build --network=host -t deepwiki:latest .

docker-run: ## 本地运行 Docker 容器
	@echo "🐳 运行 Docker 容器..."
	@docker run -p 3000:3000 -p 8001:8001 --env-file .env.local deepwiki:latest

docker-deploy-gcp: docker-build ## 部署到 Google Cloud Run
	@echo "🚀 部署到 Google Cloud Run..."
	@bash -c 'if [ -f .env.local ]; then set -a; source .env.local; set +a; fi; \
	if [ -z "$$GCP_PROJECT_ID" ]; then \
		echo "❌ 错误: GCP_PROJECT_ID 未在 .env.local 中设置"; \
		exit 1; \
	fi; \
	docker tag deepwiki:latest gcr.io/$$GCP_PROJECT_ID/deepwiki:latest; \
	docker push gcr.io/$$GCP_PROJECT_ID/deepwiki:latest; \
	gcloud run deploy deepwiki \
		--image gcr.io/$$GCP_PROJECT_ID/deepwiki:latest \
		--platform managed \
		--region us-central1 \
		--allow-unauthenticated'

deploy-all: deploy-frontend docker-build ## 部署前端和后端 (Docker)

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
	@echo "  npx wrangler secret put GOOGLE_API_KEY"
	@echo "  npx wrangler secret put OPENAI_API_KEY"
	@echo "  npx wrangler secret put LITELLM_API_KEY"
	@echo ""
	@echo "后端密钥:"
	@echo "  cd api && npx wrangler secret put GOOGLE_API_KEY"
	@echo "  cd api && npx wrangler secret put OPENAI_API_KEY"
	@echo "  cd api && npx wrangler secret put LITELLM_API_KEY"

clean: ## 清理构建文件
	@echo "🧹 清理构建文件..."
	@rm -rf .next .vercel node_modules/.cache
	@rm -rf api/__pycache__ api/**/__pycache__

install: ## 安装依赖
	@echo "📦 安装前端依赖..."
	@npm install
	@echo "📦 安装后端依赖..."
	@cd api && pip install -r requirements.txt
