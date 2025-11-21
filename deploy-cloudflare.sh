#!/usr/bin/env bash

set -euo pipefail

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

header() {
  printf "%s\n" "${BLUE}========================================${NC}"
}

info() {
  printf "%s\n" "$1"
}

precheck() {
  if [[ "$DRY_RUN" == true ]]; then
    return 0
  fi

  if ! command -v wrangler >/dev/null 2>&1; then
    printf "%s\n" "${RED}❌ 请先安装 wrangler: npm install -g wrangler${NC}"
    exit 1
  fi

  if command -v node >/dev/null 2>&1; then
    local node_ver node_major
    node_ver=$(node -v 2>/dev/null | sed 's/^v//')
    node_major=${node_ver%%.*}
    if [[ -n "$node_major" ]] && (( node_major < 20 )); then
      printf "%s\n" "${RED}❌ Node.js 版本过低 (v${node_ver})，wrangler 需要 v20.0.0 或更高版本${NC}"
      printf "%s\n" "${YELLOW}请使用以下命令升级 Node.js:${NC}"
      printf "%s\n" "${YELLOW}  Windows: nvm install 20 && nvm use 20${NC}"
      printf "%s\n" "${YELLOW}  macOS/Linux: nvm install 20 && nvm use 20${NC}"
      printf "%s\n" "${YELLOW}  或使用 Node.js 安装包: https://nodejs.org/${NC}"
      exit 1
    fi
  else
    printf "%s\n" "${RED}❌ 未检测到 Node.js，请先安装 Node.js v20+${NC}"
    exit 1
  fi

  wrangler whoami >/dev/null 2>&1 || {
    printf "%s\n" "${YELLOW}🔑 请先登录 Cloudflare: wrangler login${NC}"
    wrangler login
  }
}

parse_env_file() {
  local env_file="$1"
  if [[ ! -f "$env_file" ]]; then
    printf "%s\n" "${YELLOW}⚠️  未找到 $env_file 文件${NC}"
    return 1
  fi

  printf "%s\n" "${BLUE}📋 解析环境变量文件: $env_file${NC}"
  while IFS= read -r raw || [[ -n "$raw" ]]; do
    if [[ -z "$raw" ]] || [[ "$raw" =~ ^# ]]; then
      continue
    fi

    local key=${raw%%=*}
    local value=${raw#*=}
    key=$(printf "%s" "$key" | tr -d '\r' | sed 's/^\s*//;s/\s*$//')
    value=$(printf "%s" "$value" | tr -d '\r' | sed 's/^\s*//;s/\s*$//')
    value=${value#\"}
    value=${value%\"}
    value=${value#\'}
    value=${value%\'}

    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      printf "%s\n" "${YELLOW}⚠️  跳过非法变量名: '$key'${NC}"
      continue
    fi

    export "$key=$value"
    printf "%s\n" "${GREEN}✅ 加载变量: $key${NC}"
  done < "$env_file"
}

set_worker_env_vars() {
  local worker_name="$1" env_file="$2" mapping_file=".env.cloudflare.mapping"
  printf "%s\n" "${BLUE}🔧 设置 Worker 环境变量: $worker_name${NC}"

  if [[ ! -f "$mapping_file" ]]; then
    # 如果没有映射文件，直接读取 env 文件
    while IFS= read -r raw || [[ -n "$raw" ]]; do
      if [[ -z "$raw" ]] || [[ "$raw" =~ ^# ]]; then
        continue
      fi

      local key=${raw%%=*}
      local value=${raw#*=}
      key=$(printf "%s" "$key" | tr -d '\r' | sed 's/^\s*//;s/\s*$//')
      value=$(printf "%s" "$value" | tr -d '\r')

      if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] && [[ -n "$value" ]]; then
        wrangler secret put "$key" --name "$worker_name" <<< "$value" 2>/dev/null || true
      fi
    done < "$env_file"
    return
  fi

  # 使用映射配置
  printf "%s\n" "${BLUE}使用映射配置设置环境变量${NC}"
  while IFS=: read -r worker_var env_var default_value || [[ -n "$worker_var$env_var$default_value" ]]; do
    if [[ -z "$worker_var" ]] || [[ "$worker_var" =~ ^# ]]; then
      continue
    fi

    worker_var=$(printf "%s" "$worker_var" | tr -d '\r' | sed 's/^\s*//;s/\s*$//')
    env_var=$(printf "%s" "$env_var" | tr -d '\r' | sed 's/^\s*//;s/\s*$//')
    default_value=$(printf "%s" "$default_value" | tr -d '\r' | sed 's/^\s*//;s/\s*$//')

    local env_value=""
    if env | grep -q "^${env_var}="; then
      env_value=$(env | grep "^${env_var}=" | sed 's/^[^=]*=//')
    elif [[ -n "$default_value" ]]; then
      env_value="$default_value"
    else
      printf "%s\n" "${YELLOW}⚠️  跳过空变量: $worker_var${NC}"
      continue
    fi

    wrangler secret put "$worker_var" --name "$worker_name" <<< "$env_value" 2>/dev/null || true
  done < "$mapping_file"
}

create_cloudflare_resources() {
  printf "%s\n" "${BLUE}🛠️  创建 Cloudflare 资源...${NC}"
  wrangler kv:namespace create "CACHE_KV" 2>/dev/null || true
  wrangler kv:namespace create "CACHE_KV" --preview 2>/dev/null || true
  wrangler d1 create "codewiki-db" 2>/dev/null || true
  if ! wrangler r2 bucket create "codewiki-files" >/dev/null 2>&1; then
    printf "%s\n" "${YELLOW}⚠️  R2 未启用或无权限，跳过 R2 bucket 创建${NC}"
  fi
}

deploy_pages_frontend() {
  local output_dir=".vercel/output/static"
  printf "%s\n" "${BLUE}🚀 部署前端 Pages: codewiki${NC}"

  if [[ ! -d "$output_dir" ]]; then
    printf "%s\n" "${RED}❌ 未找到构建输出目录: $output_dir${NC}"
    return 1
  fi

  if ! wrangler pages project list | grep -q "codewiki"; then
    wrangler pages project create codewiki >/dev/null 2>&1 || true
  fi

  if ! wrangler pages deploy "$output_dir" --project-name codewiki; then
    printf "%s\n" "${RED}❌ Pages 前端部署失败${NC}"
    return 1
  fi

  printf "%s\n" "${GREEN}✅ Pages 前端部署成功${NC}"
}

deploy_worker() {
  local worker_name="$1" env_file="$2"
  printf "%s\n" "${BLUE}🚀 部署 Worker: $worker_name${NC}"

  if [[ -f "$env_file" ]]; then
    set_worker_env_vars "$worker_name" "$env_file"
  fi

  if ! wrangler deploy --name "$worker_name"; then
    printf "%s\n" "${RED}❌ Worker $worker_name 部署失败${NC}"
    return 1
  fi

  printf "%s\n" "${GREEN}✅ Worker $worker_name 部署成功${NC}"
}

build_frontend() {
  printf "%s\n" "${BLUE}📦 构建前端应用...${NC}"

  if [[ -f "package.json" ]]; then
    # 清理旧构建缓存，确保强制更新
    rm -rf .next .vercel
    if ! npm run build:pages; then
      printf "%s\n" "${RED}❌ 前端构建失败${NC}"
      printf "%s\n" "${YELLOW}请在 PowerShell 或 WSL/Linux/macOS 运行 npm run build:pages 以生成 .vercel/output/static${NC}"
      return 1
    fi
  else
    printf "%s\n" "${YELLOW}⚠️  未找到 package.json，跳过前端构建${NC}"
  fi

  printf "%s\n" "${GREEN}✅ 前端构建完成${NC}"
}

main() {
  local env_file="${1:-.env}" frontend_env_file="${2:-.env}" api_env_file="${3:-.env}"

  printf "%s\n" "🚀 开始部署 CodeWiki 到 Cloudflare..."
  header
  printf "%s\n" "${BLUE}   CodeWiki Cloudflare 部署工具${NC}"
  header
  printf "\n"

  precheck

  if [[ -f "$env_file" ]]; then
    parse_env_file "$env_file"
  fi

  [[ -z "${CF_PAGES:-}" ]] && export CF_PAGES=1
  [[ -z "${NODE_ENV:-}" ]] && export NODE_ENV=production

  local has_key=false
  [[ -n "${OPENAI_API_KEY:-}" ]] && has_key=true
  [[ -n "${GOOGLE_API_KEY:-}" ]] && has_key=true
  [[ -n "${GEMINI_API_KEY:-}" ]] && has_key=true
  [[ -n "${ANTHROPIC_API_KEY:-}" ]] && has_key=true
  [[ -n "${LITELLM_API_KEY:-}" ]] && has_key=true
  if [[ "$has_key" == false ]]; then
    printf "%s\n" "⚠️  请在环境文件中设置至少一个模型提供商 API 密钥"
    return 1
  fi
  if [[ "${OPENAI_API_KEY:-}" == "sk-your-openai-api-key-here" ]]; then
    printf "%s\n" "⚠️  OPENAI_API_KEY 为占位符，请配置有效密钥"
    return 1
  fi

  create_cloudflare_resources
  build_frontend

  printf "\n"
  header
  printf "%s\n" "${BLUE}   部署前端 Pages (codewiki)${NC}"
  header
  deploy_pages_frontend

  printf "\n"
  header
  printf "%s\n" "${BLUE}   部署后端 API Worker (codewiki-service)${NC}"
  header

  if [[ -d "api" ]]; then
    deploy_worker "codewiki-service" "$api_env_file"
  else
    printf "%s\n" "${YELLOW}⚠️  未找到 api 目录，跳过后端部署${NC}"
  fi
}

show_help() {
  printf "%s\n" "用法: $0 [选项] [环境变量文件]"
  printf "%s\n" ""
  printf "%s\n" "选项:"
  printf "%s\n" "  -h, --help          显示帮助信息"
  printf "%s\n" "  -e, --env FILE      指定主环境变量文件（默认: .env）"
  printf "%s\n" "  -f, --frontend FILE 指定前端环境变量文件"
  printf "%s\n" "  -a, --api FILE      指定 API 环境变量文件"
  printf "%s\n" "  --dry-run           模拟运行，不实际部署"
  printf "%s\n" ""
  printf "%s\n" "示例:"
  printf "%s\n" "  $0                    # 使用默认 .env 文件"
  printf "%s\n" "  $0 .env.production    # 使用指定的环境文件"
  printf "%s\n" "  $0 --dry-run          # 干运行测试"
}

# 默认配置
ENV_FILE=".env"
FRONTEND_ENV_FILE=""
API_ENV_FILE=""
DRY_RUN=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_help
      exit 0
      ;;
    -e|--env)
      ENV_FILE="$2"
      shift 2
      ;;
    -f|--frontend)
      FRONTEND_ENV_FILE="$2"
      shift 2
      ;;
    -a|--api)
      API_ENV_FILE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      # 处理位置参数
      if [[ -z "$FRONTEND_ENV_FILE" ]]; then
        FRONTEND_ENV_FILE="$1"
      elif [[ -z "$API_ENV_FILE" ]]; then
        API_ENV_FILE="$1"
      fi
      shift
      ;;
  esac
done

# 设置默认值
[[ -z "$FRONTEND_ENV_FILE" ]] && FRONTEND_ENV_FILE="$ENV_FILE"
[[ -z "$API_ENV_FILE" ]] && API_ENV_FILE="$ENV_FILE"

# 自动选择 Cloudflare 环境文件
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f ".env.cloudflare" ]]; then
    ENV_FILE=".env.cloudflare"
    [[ "$FRONTEND_ENV_FILE" == ".env" ]] && FRONTEND_ENV_FILE=".env.cloudflare"
    [[ "$API_ENV_FILE" == ".env" ]] && API_ENV_FILE=".env.cloudflare"
  else
    cat > .env.cloudflare << 'EOF'
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
CF_PAGES=1
DEFAULT_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key-here
GOOGLE_API_KEY=
GEMINI_API_KEY=
LITELLM_BASE_URL=
LITELLM_API_KEY=
ANTHROPIC_API_KEY=
SERVER_BASE_URL=
DEEPWIKI_EMBEDDER_TYPE=google
EOF
    printf "%s\n" "⚠️  已生成 .env.cloudflare，请填写 API 密钥后重试"
    exit 1
  fi
fi

# 基础校验
if [[ -f "$ENV_FILE" ]] && grep -q "sk-your-openai-api-key-here" "$ENV_FILE"; then
  printf "%s\n" "⚠️  请在 $ENV_FILE 中配置有效的 OPENAI_API_KEY 或其他模型提供商密钥"
  exit 1
fi

# 干运行模式
if [[ "$DRY_RUN" == true ]]; then
  printf '%s\n' "${BLUE}DRY RUN - 显示配置但不实际部署${NC}"
  printf '%s\n' "主环境变量文件: $ENV_FILE"
  printf '%s\n' "前端环境变量文件: $FRONTEND_ENV_FILE"
  printf '%s\n' "API 环境变量文件: $API_ENV_FILE"

  if [[ -f "$ENV_FILE" ]]; then
    printf '%s\n' "${BLUE}环境变量内容:${NC}"
    cat "$ENV_FILE"
  fi

  exit 0
fi

# 执行主函数
main "$ENV_FILE" "$FRONTEND_ENV_FILE" "$API_ENV_FILE"