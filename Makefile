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

gcp-enable-apis: ## 启用 Google Cloud 所需的 API
	@bash -c 'if [ -f .env.local ]; then set -a; source .env.local; set +a; fi; \
	if [ -z "$$GCP_PROJECT_ID" ]; then \
		echo "❌ 错误: GCP_PROJECT_ID 未在 .env.local 中设置"; \
		exit 1; \
	fi; \
	if [ -z "$$GCP_API_TOKEN" ]; then \
		echo "❌ 错误: GCP_API_TOKEN 未在 .env.local 中设置"; \
		exit 1; \
	fi; \
	echo "🔧 启用所需的 Google Cloud API..."; \
	for api in artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com; do \
		echo "  启用 $$api..."; \
		curl -s -X POST \
			-H "Authorization: Bearer $$GCP_API_TOKEN" \
			-H "Content-Type: application/json" \
			"https://serviceusage.googleapis.com/v1/projects/$$GCP_PROJECT_ID/services/$$api:enable" \
			> /dev/null 2>&1 || true; \
	done; \
	echo "✅ API 启用请求已发送 (如果已启用会显示已启用)"'

docker-deploy-gcp: docker-build ## 部署到 Google Cloud Run
	@echo "🚀 部署到 Google Cloud Run..."
	@bash -c 'if [ -f .env.local ]; then set -a; source .env.local; set +a; fi; \
	if [ -z "$$GCP_PROJECT_ID" ]; then \
		echo "❌ 错误: GCP_PROJECT_ID 未在 .env.local 中设置"; \
		exit 1; \
	fi; \
	if [ -z "$$GCP_API_TOKEN" ]; then \
		echo "❌ 错误: GCP_API_TOKEN 未在 .env.local 中设置"; \
		exit 1; \
	fi; \
	if ! command -v docker &> /dev/null; then \
		echo "❌ 错误: Docker 未安装"; \
		exit 1; \
	fi; \
	if ! command -v curl &> /dev/null; then \
		echo "❌ 错误: curl 未安装"; \
		exit 1; \
	fi; \
	echo "🔧 检查并启用所需的 Google Cloud API..."; \
	for api in artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com; do \
		echo "  检查 $$api..."; \
		API_STATUS=$$(curl -s -X GET \
			-H "Authorization: Bearer $$GCP_API_TOKEN" \
			"https://serviceusage.googleapis.com/v1/projects/$$GCP_PROJECT_ID/services/$$api" 2>/dev/null | grep -o '"state":"[^"]*"' | cut -d'"' -f4 || echo "DISABLED"); \
		if [ "$$API_STATUS" != "ENABLED" ]; then \
			echo "  启用 $$api..."; \
			curl -s -X POST \
				-H "Authorization: Bearer $$GCP_API_TOKEN" \
				-H "Content-Type: application/json" \
				"https://serviceusage.googleapis.com/v1/projects/$$GCP_PROJECT_ID/services/$$api:enable" \
				> /dev/null 2>&1 || true; \
		else \
			echo "  $$api 已启用"; \
		fi; \
	done; \
	echo "⏳ 等待 API 启用生效 (30秒)..."; \
	sleep 30; \
	echo "🔐 使用 API Token 登录到 Google Container Registry..."; \
	echo "$$GCP_API_TOKEN" | docker login -u oauth2accesstoken --password-stdin https://gcr.io || { \
		echo "❌ Docker 登录失败"; \
		exit 1; \
	}; \
	echo "📦 标记 Docker 镜像..."; \
	docker tag deepwiki:latest gcr.io/$$GCP_PROJECT_ID/deepwiki:latest; \
	echo "📤 推送镜像到 Google Container Registry..."; \
	MAX_RETRIES=3; \
	RETRY_COUNT=0; \
	while [ $$RETRY_COUNT -lt $$MAX_RETRIES ]; do \
		if docker push gcr.io/$$GCP_PROJECT_ID/deepwiki:latest 2>&1 | tee /tmp/docker-push.log; then \
			break; \
		fi; \
		if grep -q "Artifact Registry API" /tmp/docker-push.log 2>/dev/null || grep -q "API has not been used" /tmp/docker-push.log 2>/dev/null; then \
			RETRY_COUNT=$$((RETRY_COUNT + 1)); \
			if [ $$RETRY_COUNT -lt $$MAX_RETRIES ]; then \
				echo ""; \
				echo "⚠️  API 可能仍在启用中，等待 30 秒后重试 ($$RETRY_COUNT/$$MAX_RETRIES)..."; \
				sleep 30; \
				echo "  重新启用 API..."; \
				for api in artifactregistry.googleapis.com containerregistry.googleapis.com; do \
					curl -s -X POST \
						-H "Authorization: Bearer $$GCP_API_TOKEN" \
						-H "Content-Type: application/json" \
						"https://serviceusage.googleapis.com/v1/projects/$$GCP_PROJECT_ID/services/$$api:enable" \
						> /dev/null 2>&1 || true; \
				done; \
				sleep 30; \
			else \
				echo ""; \
				echo "❌ 错误: 无法启用所需的 API 或 API 仍在传播中"; \
				echo ""; \
				echo "请稍后重试，或手动访问:"; \
				echo "  https://console.developers.google.com/apis/api/artifactregistry.googleapis.com/overview?project=$$GCP_PROJECT_ID"; \
				exit 1; \
			fi; \
		else \
			echo "❌ Docker 推送失败:"; \
			cat /tmp/docker-push.log; \
			exit 1; \
		fi; \
		done; \
	echo "✅ 镜像推送成功！"; \
	echo "🚀 部署到 Cloud Run..."; \
	IMAGE_URL="gcr.io/$$GCP_PROJECT_ID/deepwiki:latest"; \
	REGION="us-central1"; \
	SERVICE_NAME="deepwiki"; \
	LOCATION="projects/$$GCP_PROJECT_ID/locations/$$REGION"; \
	SERVICE_PATH="$$LOCATION/services/$$SERVICE_NAME"; \
	echo "  部署服务到 Cloud Run..."; \
	SERVICE_JSON="{\"apiVersion\":\"serving.knative.dev/v1\",\"kind\":\"Service\",\"metadata\":{\"name\":\"$$SERVICE_NAME\"},\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"image\":\"$$IMAGE_URL\"}]}},\"traffic\":[{\"percent\":100,\"latestRevision\":true}]}}"; \
	echo "  尝试创建服务..."; \
	RESPONSE=$$(curl -s -w "\n%{http_code}" -X POST \
		-H "Authorization: Bearer $$GCP_API_TOKEN" \
		-H "Content-Type: application/json" \
		-d "$$SERVICE_JSON" \
		"https://run.googleapis.com/v1/$$LOCATION/services"); \
	HTTP_CODE=$$(echo "$$RESPONSE" | tail -n1); \
	RESPONSE_BODY=$$(echo "$$RESPONSE" | head -n -1); \
	if [ "$$HTTP_CODE" = "200" ] || [ "$$HTTP_CODE" = "201" ]; then \
		echo "✅ 服务创建成功"; \
	elif echo "$$RESPONSE_BODY" | grep -q "already exists" || [ "$$HTTP_CODE" = "409" ]; then \
		echo "  服务已存在，更新中..."; \
		RESPONSE=$$(curl -s -w "\n%{http_code}" -X PUT \
			-H "Authorization: Bearer $$GCP_API_TOKEN" \
			-H "Content-Type: application/json" \
			-d "$$SERVICE_JSON" \
			"https://run.googleapis.com/v1/$$SERVICE_PATH"); \
		HTTP_CODE=$$(echo "$$RESPONSE" | tail -n1); \
		RESPONSE_BODY=$$(echo "$$RESPONSE" | head -n -1); \
		if [ "$$HTTP_CODE" != "200" ] && [ "$$HTTP_CODE" != "201" ]; then \
			echo "⚠️  PUT 更新失败 (HTTP $$HTTP_CODE)，尝试 PATCH..."; \
			RESPONSE=$$(curl -s -w "\n%{http_code}" -X PATCH \
				-H "Authorization: Bearer $$GCP_API_TOKEN" \
				-H "Content-Type: application/json" \
				-d "{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"image\":\"$$IMAGE_URL\"}]}}}}" \
				"https://run.googleapis.com/v1/$$SERVICE_PATH?updateMask=spec.template.spec.containers"); \
			HTTP_CODE=$$(echo "$$RESPONSE" | tail -n1); \
			RESPONSE_BODY=$$(echo "$$RESPONSE" | head -n -1); \
		fi; \
		if [ "$$HTTP_CODE" != "200" ] && [ "$$HTTP_CODE" != "201" ]; then \
			echo "❌ 更新服务失败 (HTTP $$HTTP_CODE):"; \
			echo "$$RESPONSE_BODY" | head -50; \
			exit 1; \
		fi; \
		echo "✅ 服务更新成功"; \
	else \
		echo "❌ 创建服务失败 (HTTP $$HTTP_CODE):"; \
		echo "$$RESPONSE_BODY" | head -50; \
		exit 1; \
	fi; \
	echo "✅ 部署成功！"; \
	sleep 3; \
	SERVICE_INFO=$$(curl -s -X GET \
		-H "Authorization: Bearer $$GCP_API_TOKEN" \
		"https://run.googleapis.com/v1/$$SERVICE_PATH" 2>/dev/null); \
	SERVICE_URL=$$(echo "$$SERVICE_INFO" | grep -o "\"url\":\"[^\"]*\"" | head -1 | cut -d"\"" -f4); \
	if [ -n "$$SERVICE_URL" ]; then \
		echo "🌐 服务 URL: $$SERVICE_URL"; \
	fi'

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
