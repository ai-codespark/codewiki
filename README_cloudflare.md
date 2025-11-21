# CodeWiki Cloudflare 部署指南

本指南将帮助您将 CodeWiki 部署到 Cloudflare Workers 和 Pages。

## 🚀 快速开始

### 1. 环境变量配置

系统会自动从 `.env` 文件读取环境变量并配置到 Cloudflare Workers。

#### 基础配置（必需）
```bash
# 复制示例文件
cp .env.example .env

# 编辑配置文件
nano .env
```

#### 环境变量
```
SERVER_BASE_URL=http://localhost:8001
DEEPWIKI_EMBEDDER_TYPE=google
LITELLM_BASE_URL=http://litellm.example
LITELLM_API_KEY=sk-1234
```

### 2. 部署命令

```bash
# 基础部署（使用默认 .env 文件）
bash deploy-cloudflare.sh

# 干运行测试（不实际部署）
bash deploy-cloudflare.sh --dry-run

# 使用特定环境文件
bash deploy-cloudflare.sh .env.production

# 分别指定前端和后端环境文件
bash deploy-cloudflare.sh -e .env -f .env.frontend -a .env.api
```

### 3. 环境变量映射

系统会自动将 `.env` 文件中的变量映射到 Cloudflare Workers 环境变量：

| Cloudflare Worker 变量 | .env 变量 | 默认值 |
|----------------------|-----------|--------|
| SERVER_BASE_URL | SERVER_BASE_URL | http://localhost:8001 |
| DEEPWIKI_EMBEDDER_TYPE | DEEPWIKI_EMBEDDER_TYPE | google |
| LITELLM_BASE_URL | LITELLM_BASE_URL | - |
| LITELLM_API_KEY | LITELLM_API_KEY | - |
| OPENAI_API_KEY | OPENAI_API_KEY | - |
| ANTHROPIC_API_KEY | ANTHROPIC_API_KEY | - |

## 📋 部署步骤

### 步骤 1: 安装依赖
```bash
npm install -g wrangler
wrangler login
```

### 步骤 2: 配置环境变量
```bash
# 编辑 .env 文件
nano .env
```

### 步骤 3: 执行部署
```bash
bash deploy-cloudflare.sh
```

## 🔧 配置文件说明

### wrangler.toml
主要的 Cloudflare Workers 配置文件，包含：
- 前端 Worker 配置
- 后端 API Worker 配置
- KV 命名空间配置
- D1 数据库配置
- R2 存储配置

### .env.cloudflare.mapping
环境变量映射配置文件，定义 .env 变量到 Cloudflare Worker 变量的映射关系。

### deploy-cloudflare.sh
部署脚本，功能包括：
- 解析 .env 文件
- 创建 Cloudflare 资源
- 设置环境变量
- 部署 Workers

## 🛠️ 高级用法

### 多环境部署
```bash
# 开发环境
bash deploy-cloudflare.sh .env.development

# 生产环境
bash deploy-cloudflare.sh .env.production

# 测试环境
bash deploy-cloudflare.sh .env.staging
```

### 自定义环境变量映射
编辑 `.env.cloudflare.mapping` 文件：
```
# 格式: WORKER_VAR:ENV_VAR:DEFAULT_VALUE
MY_CUSTOM_VAR:MY_ENV_VAR:default_value
```

### 手动设置环境变量
```bash
# 为特定 Worker 设置环境变量
wrangler secret put MY_VAR --name codewiki-frontend
wrangler secret put MY_VAR --name codewiki-api
```

## 📊 监控和调试

### 查看日志
```bash
# 前端 Worker 日志
wrangler tail --name codewiki-frontend

# 后端 API Worker 日志
wrangler tail --name codewiki-api
```

### 检查环境变量
```bash
# 在 Worker 中查看环境变量
curl https://your-worker.workers.dev/api/debug/env
```

## 📋 架构说明

### 前端 Worker (`src/index.ts`)
- 处理静态资源请求
- 转发 API 请求到后端 Worker
- 管理 R2 存储中的文件

### 后端 API Worker (`api/index.ts`)
- 提供 RESTful API 接口
- 集成 Cloudflare AI 模型
- 管理 D1 数据库和 KV 缓存

### 数据存储
- **KV**: 缓存和会话存储
- **D1**: 用户数据和项目信息
- **R2**: 文件和静态资源存储

## 🔧 开发环境

### 本地开发

```bash
# 启动前端开发服务器
npm run dev

# 启动后端 API（需要 Python 环境）
cd api
python main.py
```

### 本地测试 Workers

```bash
# 测试前端 Worker
wrangler dev --name codewiki-frontend

# 测试后端 API Worker
cd api
wrangler dev --name codewiki-api
```

## 🛠️ 高级配置

### 自定义域名

1. 在 Cloudflare 控制台添加自定义域名
2. 更新 `wrangler.toml` 中的 `zone_name`
3. 配置 DNS 记录指向 Workers

### 环境变量管理

使用不同的环境配置：

```toml
[env.staging]
name = "codewiki-staging"
[env.staging.vars]
NODE_ENV = "staging"

[env.production]
name = "codewiki-prod"
[env.production.vars]
NODE_ENV = "production"
```

### 监控和日志

- 使用 Cloudflare Analytics 监控性能
- 配置 Logpush 进行日志收集
- 设置告警规则

## 📚 API 文档

### 端点列表

- `GET /api/auth/status` - 获取认证状态
- `POST /api/auth/validate` - 验证认证令牌
- `GET /api/wiki/projects` - 获取项目列表
- `POST /api/chat/stream` - 聊天流接口
- `GET /api/lang/config` - 获取语言配置
- `GET/POST /api/wiki_cache/*` - Wiki 缓存管理
- `GET /export/wiki/*` - 导出 Wiki
- `GET /local_repo/structure` - 仓库结构

## 🔒 安全建议

1. **API 密钥管理**: 使用 `wrangler secret put` 命令设置敏感信息
2. **环境隔离**: 为不同环境使用不同的环境文件
3. **访问控制**: 限制 Cloudflare 控制台的访问权限
4. **日志审计**: 定期检查 Worker 日志

## 🐛 故障排除

### 常见问题

1. **环境变量未生效**
   - 检查 `.env` 文件格式
   - 验证映射配置
   - 重新部署 Worker

2. **部署失败**
   - 检查 wrangler 版本
   - 验证 Cloudflare 登录状态
   - 查看错误日志

3. **Worker 无法访问**
   - 检查路由配置
   - 验证域名设置
   - 检查环境变量

### 调试工具
```bash
# 测试环境变量解析
bash test-env-parsing.sh

# 干运行模式
bash deploy-cloudflare.sh --dry-run

# 查看 Worker 信息
wrangler info --name codewiki-frontend
wrangler info --name codewiki-api
```

## 📞 支持

如有问题，请查看：
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [Next.js 部署指南](https://nextjs.org/docs/deployment)
- 项目 GitHub Issues