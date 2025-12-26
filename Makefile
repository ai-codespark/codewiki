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
	echo "📋 检查环境变量..."; \
	if [ -z "$$GCP_PROJECT_ID" ]; then \
		echo "❌ 错误: GCP_PROJECT_ID 未在 .env.local 中设置"; \
		exit 1; \
	fi; \
	if [ -z "$$GCP_API_TOKEN" ]; then \
		echo "❌ 错误: GCP_API_TOKEN 未在 .env.local 中设置"; \
		exit 1; \
	fi; \
	if [ -n "$$CLOUDFLARE_API_TOKEN" ]; then \
		echo "✅ CLOUDFLARE_API_TOKEN 已从 .env.local 加载"; \
	else \
		echo "⚠️  警告: CLOUDFLARE_API_TOKEN 未在 .env.local 中设置 (可选)"; \
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
	echo "🔐 登录到 Google Container Registry..."; \
	if command -v gcloud &> /dev/null; then \
		echo "  使用 gcloud CLI 进行身份验证..."; \
		gcloud auth configure-docker gcr.io --quiet || { \
			echo "⚠️  gcloud 配置失败，尝试使用 API Token..."; \
			echo "$$GCP_API_TOKEN" | docker login -u oauth2accesstoken --password-stdin https://gcr.io || { \
				echo "❌ Docker 登录失败"; \
				echo ""; \
				echo "请尝试以下方法之一:"; \
				echo "1. 安装 gcloud CLI: https://cloud.google.com/sdk/docs/install"; \
				echo "2. 运行: gcloud auth login"; \
				echo "3. 运行: gcloud auth configure-docker gcr.io"; \
				echo "4. 或者确保 GCP_API_TOKEN 具有正确的权限和范围"; \
				exit 1; \
			}; \
		}; \
	else \
		echo "  使用 API Token 进行身份验证..."; \
		echo "$$GCP_API_TOKEN" | docker login -u oauth2accesstoken --password-stdin https://gcr.io || { \
			echo "❌ Docker 登录失败"; \
			echo ""; \
			echo "可能的原因:"; \
			echo "1. GCP_API_TOKEN 无效或已过期"; \
			echo "2. Token 缺少必要的权限范围"; \
			echo "3. 需要使用 gcloud CLI 进行身份验证"; \
			echo ""; \
			echo "解决方案:"; \
			echo "1. 安装 gcloud CLI: https://cloud.google.com/sdk/docs/install"; \
			echo "2. 运行: gcloud auth login"; \
			echo "3. 运行: gcloud auth configure-docker gcr.io"; \
			echo "4. 或者生成新的访问令牌，确保包含以下范围:"; \
			echo "   - https://www.googleapis.com/auth/cloud-platform"; \
			echo "   - https://www.googleapis.com/auth/devstorage.read_write"; \
			exit 1; \
		}; \
	fi; \
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
	USE_TOKEN="$$GCP_API_TOKEN"; \
	if command -v gcloud &> /dev/null; then \
		echo "  使用 gcloud 获取访问令牌..."; \
		if gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 | grep -q .; then \
			echo "  刷新访问令牌..."; \
			USE_TOKEN=$$(gcloud auth print-access-token 2>/dev/null || echo "$$GCP_API_TOKEN"); \
		else \
			echo "  ⚠️  gcloud 未登录，使用 GCP_API_TOKEN..."; \
		fi; \
	fi; \
	if [ -z "$$USE_TOKEN" ] || [ "$$USE_TOKEN" = "null" ]; then \
		echo "❌ 错误: 无法获取有效的访问令牌"; \
		echo ""; \
		echo "请使用以下方法之一获取有效的令牌:"; \
		echo "1. 使用 gcloud CLI:"; \
		echo "   gcloud auth login"; \
		echo "   gcloud auth print-access-token"; \
		echo ""; \
		echo "2. 或确保 GCP_API_TOKEN 是有效的 OAuth2 访问令牌"; \
		echo "   所需范围: https://www.googleapis.com/auth/cloud-platform"; \
		exit 1; \
	fi; \
	SERVICE_JSON="{\"apiVersion\":\"serving.knative.dev/v1\",\"kind\":\"Service\",\"metadata\":{\"name\":\"$$SERVICE_NAME\"},\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"image\":\"$$IMAGE_URL\"}]}},\"traffic\":[{\"percent\":100,\"latestRevision\":true}]}}"; \
	echo "  尝试创建服务..."; \
	RESPONSE=$$(curl -s -w "\n%{http_code}" -X POST \
		-H "Authorization: Bearer $$USE_TOKEN" \
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
			-H "Authorization: Bearer $$USE_TOKEN" \
			-H "Content-Type: application/json" \
			-d "$$SERVICE_JSON" \
			"https://run.googleapis.com/v1/$$SERVICE_PATH"); \
		HTTP_CODE=$$(echo "$$RESPONSE" | tail -n1); \
		RESPONSE_BODY=$$(echo "$$RESPONSE" | head -n -1); \
		if [ "$$HTTP_CODE" != "200" ] && [ "$$HTTP_CODE" != "201" ]; then \
			echo "⚠️  PUT 更新失败 (HTTP $$HTTP_CODE)，尝试 PATCH..."; \
			RESPONSE=$$(curl -s -w "\n%{http_code}" -X PATCH \
				-H "Authorization: Bearer $$USE_TOKEN" \
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
		if [ "$$HTTP_CODE" = "401" ] || echo "$$RESPONSE_BODY" | grep -q "UNAUTHENTICATED" || echo "$$RESPONSE_BODY" | grep -q "ACCESS_TOKEN_TYPE_UNSUPPORTED"; then \
			echo ""; \
			echo "🔐 身份验证失败。请尝试以下解决方案:"; \
			echo ""; \
			echo "1. 使用 gcloud CLI 获取新令牌:"; \
			echo "   gcloud auth login"; \
			echo "   gcloud auth application-default login"; \
			echo "   然后重新运行部署命令"; \
			echo ""; \
			echo "2. 或更新 .env.local 中的 GCP_API_TOKEN:"; \
			echo "   运行: gcloud auth print-access-token"; \
			echo "   将输出复制到 .env.local 中的 GCP_API_TOKEN"; \
			echo ""; \
			echo "3. 确保令牌具有以下范围:"; \
			echo "   - https://www.googleapis.com/auth/cloud-platform"; \
			echo "   - https://www.googleapis.com/auth/run"; \
		fi; \
		exit 1; \
	fi; \
	echo "🔓 配置服务允许未认证访问..."; \
	IAM_POLICY_JSON="{\"policy\":{\"bindings\":[{\"role\":\"roles/run.invoker\",\"members\":[\"allUsers\"]}]}}"; \
	IAM_RESPONSE=$$(curl -s -w "\n%{http_code}" -X POST \
		-H "Authorization: Bearer $$USE_TOKEN" \
		-H "Content-Type: application/json" \
		-d "$$IAM_POLICY_JSON" \
		"https://run.googleapis.com/v1/$$SERVICE_PATH:setIamPolicy"); \
	IAM_HTTP_CODE=$$(echo "$$IAM_RESPONSE" | tail -n1); \
	if [ "$$IAM_HTTP_CODE" = "200" ] || [ "$$IAM_HTTP_CODE" = "201" ]; then \
		echo "✅ 已配置允许未认证访问"; \
	else \
		echo "⚠️  警告: 无法自动配置未认证访问 (HTTP $$IAM_HTTP_CODE)"; \
		echo "   请手动运行以下命令:"; \
		echo "   gcloud run services add-iam-policy-binding $$SERVICE_NAME \\"; \
		echo "     --region=$$REGION \\"; \
		echo "     --member=\"allUsers\" \\"; \
		echo "     --role=\"roles/run.invoker\""; \
	fi; \
	echo "✅ 部署成功！"; \
	sleep 3; \
	echo "📡 获取服务信息..."; \
	SERVICE_INFO=$$(curl -s -X GET \
		-H "Authorization: Bearer $$USE_TOKEN" \
		"https://run.googleapis.com/v1/$$SERVICE_PATH" 2>/dev/null); \
	SERVICE_URL=$$(echo "$$SERVICE_INFO" | grep -o "\"url\":\"[^\"]*\"" | head -1 | cut -d"\"" -f4); \
	if [ -n "$$SERVICE_URL" ]; then \
		echo ""; \
		echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; \
		echo "🌐 Cloud Run 服务已部署"; \
		echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; \
		echo ""; \
		echo "📍 服务 URL:"; \
		echo "   $$SERVICE_URL"; \
		echo ""; \
		echo "📋 在 .env.local 中设置 SERVER_BASE_URL:"; \
		echo "   SERVER_BASE_URL=$$SERVICE_URL"; \
		echo ""; \
		echo "💡 提示: 复制上面的 SERVER_BASE_URL 到你的 .env.local 文件中"; \
		echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; \
	else \
		echo "⚠️  无法获取服务 URL，请手动检查 Cloud Run 控制台"; \
		echo "   https://console.cloud.google.com/run?project=$$GCP_PROJECT_ID"; \
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

gcp-fix-auth: ## 修复 Cloud Run 服务的未认证访问权限
	@bash -c 'if [ -f .env.local ]; then set -a; source .env.local; set +a; fi; \
	if [ -z "$$GCP_PROJECT_ID" ]; then \
		echo "❌ 错误: GCP_PROJECT_ID 未在 .env.local 中设置"; \
		exit 1; \
	fi; \
	SERVICE_NAME="deepwiki"; \
	REGION="us-central1"; \
	SERVICE_PATH="projects/$$GCP_PROJECT_ID/locations/$$REGION/services/$$SERVICE_NAME"; \
	echo "🔓 配置 Cloud Run 服务允许未认证访问..."; \
	if command -v gcloud &> /dev/null; then \
		echo "  使用 gcloud CLI..."; \
		gcloud run services add-iam-policy-binding $$SERVICE_NAME \
			--region=$$REGION \
			--member="allUsers" \
			--role="roles/run.invoker" \
			--project=$$GCP_PROJECT_ID || { \
			echo "❌ 配置失败，请检查权限"; \
			exit 1; \
		}; \
		echo "✅ 已配置允许未认证访问"; \
	else \
		echo "  使用 REST API..."; \
		if [ -z "$$GCP_API_TOKEN" ]; then \
			echo "❌ 错误: GCP_API_TOKEN 未在 .env.local 中设置"; \
			exit 1; \
		fi; \
		USE_TOKEN="$$GCP_API_TOKEN"; \
		if gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 | grep -q . 2>/dev/null; then \
			USE_TOKEN=$$(gcloud auth print-access-token 2>/dev/null || echo "$$GCP_API_TOKEN"); \
		fi; \
		IAM_POLICY_JSON="{\"policy\":{\"bindings\":[{\"role\":\"roles/run.invoker\",\"members\":[\"allUsers\"]}]}}"; \
		IAM_RESPONSE=$$(curl -s -w "\n%{http_code}" -X POST \
			-H "Authorization: Bearer $$USE_TOKEN" \
			-H "Content-Type: application/json" \
			-d "$$IAM_POLICY_JSON" \
			"https://run.googleapis.com/v1/$$SERVICE_PATH:setIamPolicy"); \
		IAM_HTTP_CODE=$$(echo "$$IAM_RESPONSE" | tail -n1); \
		if [ "$$IAM_HTTP_CODE" = "200" ] || [ "$$IAM_HTTP_CODE" = "201" ]; then \
			echo "✅ 已配置允许未认证访问"; \
		else \
			echo "❌ 配置失败 (HTTP $$IAM_HTTP_CODE)"; \
			echo "   请手动运行:"; \
			echo "   gcloud run services add-iam-policy-binding $$SERVICE_NAME \\"; \
			echo "     --region=$$REGION \\"; \
			echo "     --member=\"allUsers\" \\"; \
			echo "     --role=\"roles/run.invoker\""; \
			exit 1; \
		fi; \
	fi'

clean: ## 清理构建文件
	@echo "🧹 清理构建文件..."
	@rm -rf .next .vercel node_modules/.cache
	@rm -rf api/__pycache__ api/**/__pycache__

install: ## 安装依赖
	@echo "📦 安装前端依赖..."
	@npm install
	@echo "📦 安装后端依赖..."
	@cd api && pip install -r requirements.txt
