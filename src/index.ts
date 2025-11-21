// Cloudflare Worker 入口文件 for CodeWiki Frontend

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API 路由转发到后端 Workers
    if (url.pathname.startsWith('/api/')) {
      return handleAPIRoute(request, env);
    }

    // 静态资源处理
    if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/static/')) {
      return handleStaticAssets(request, env);
    }

    // 主应用路由
    return handleMainApp(request, env);
  },
};

export default worker;

// 处理 API 路由
async function handleAPIRoute(request: Request, env: Env): Promise<Response> {
  // 转发到后端 API Workers
  const apiWorker = env.codewiki_api;
  if (apiWorker) {
    return apiWorker.fetch(request);
  }

  // 如果没有配置后端 Workers，返回错误
  return new Response('API service not available', { status: 503 });
}

// 处理静态资源
async function handleStaticAssets(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (env.FILES) {
    const key = url.pathname.substring(1);
    const object = await env.FILES.get(key);
    if (object) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      return new Response(object.body, { headers });
    }
  }

  if (env.CACHE_KV) {
    const key = url.pathname.substring(1);
    const body = await env.CACHE_KV.get(key, { type: 'arrayBuffer' } as any);
    if (body) {
      return new Response(body as any, {
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    }
  }

  if ((env as any).SERVER_BASE_URL) {
    const resp = await fetch(((env as any).SERVER_BASE_URL as string) + url.pathname, {
      method: request.method,
      headers: request.headers,
    });
    if (resp.status !== 404) return resp;
  }

  // 返回 404 如果资源不存在
  return new Response('Asset not found', { status: 404 });
}

// 处理主应用
async function handleMainApp(request: Request, env: Env): Promise<Response> {
  // 这里应该返回 Next.js 构建的 HTML
  // 由于 Next.js 需要特殊处理，我们返回一个占位符响应
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>CodeWiki</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .status { padding: 20px; background: #f0f0f0; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>CodeWiki</h1>
        <div class="status">
            <h2>部署状态</h2>
            <p>✅ Frontend Worker 已部署</p>
            <p>✅ API Worker 已配置</p>
            <p>📁 R2 存储: ${env.FILES ? '已连接' : '未配置'}</p>
            <p>🗄️ D1 数据库: ${env.CODEDB ? '已连接' : '未配置'}</p>
            <p>⚡ KV 缓存: ${env.CACHE_KV ? '已连接' : '未配置'}</p>
        </div>
        <p>
            这是一个占位符页面。要完整部署 Next.js 应用，需要：
        </p>
        <ol>
            <li>使用 <code>@cloudflare/next-on-pages</code> 适配器</li>
            <li>配置 Next.js 为边缘运行时</li>
            <li>构建并部署到 Cloudflare Pages</li>
        </ol>
    </div>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=utf-8',
    },
  });
}

// TypeScript 类型定义
interface Env {
  codewiki_api?: any;
  CACHE_KV?: any;
  CODEDB?: any;
  FILES?: any;
  AI?: any;
}