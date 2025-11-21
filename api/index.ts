// Cloudflare Worker 入口文件 for CodeWiki API Backend
// 注意：由于 Cloudflare Workers 主要支持 JavaScript/TypeScript，
// 我们需要将 Python API 转换为 Workers 兼容格式

export interface Env {
  CACHE_KV: any;
  CODEDB: any;
  FILES: any;
  AI: any;

  // API Keys
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_ENDPOINT?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  GOOGLE_API_KEY?: string;
}

const apiWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // 设置 CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // 处理预检请求
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 路由处理
      if (url.pathname.startsWith('/api/chat/stream')) {
        return handleChatStream(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/wiki/projects')) {
        return handleWikiProjects(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/auth/status')) {
        return handleAuthStatus(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/auth/validate')) {
        return handleAuthValidate(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/lang/config')) {
        return handleLangConfig(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/wiki_cache')) {
        return handleWikiCache(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/export/wiki')) {
        return handleExportWiki(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/local_repo/structure')) {
        return handleLocalRepoStructure(request, env, corsHeaders);
      }

      // 默认响应
      return new Response(JSON.stringify({
        message: 'CodeWiki API Worker',
        version: '1.0.0',
        endpoints: [
          '/api/chat/stream',
          '/api/wiki/projects',
          '/api/auth/status',
          '/api/auth/validate',
          '/api/lang/config',
          '/api/wiki_cache',
          '/export/wiki',
          '/local_repo/structure'
        ]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

export default apiWorker;

// 处理聊天流
async function handleChatStream(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  if (!env.AI) {
    return new Response(JSON.stringify({ error: 'AI service not available' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 这里应该实现聊天流逻辑
  // 由于需要复杂的 Python 逻辑转换，这里返回模拟响应
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const messages = [
        'data: {"message": "Hello from CodeWiki API!"}\n\n',
        'data: {"message": "This is a simulated chat response."}\n\n',
        'data: {"message": "Full implementation requires Python to JS conversion."}\n\n',
      ];

      let index = 0;
      const interval = setInterval(() => {
        if (index < messages.length) {
          controller.enqueue(encoder.encode(messages[index]));
          index++;
        } else {
          controller.close();
          clearInterval(interval);
        }
      }, 1000);
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// 处理 Wiki 项目
async function handleWikiProjects(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 从 D1 数据库获取项目列表
  if (env.CODEDB) {
    try {
      const { results } = await env.CODEDB.prepare(
        'SELECT * FROM projects ORDER BY created_at DESC'
      ).all();

      return new Response(JSON.stringify({ projects: results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Database error:', error);
    }
  }

  // 返回模拟数据
  return new Response(JSON.stringify({
    projects: [
      {
        id: 1,
        name: 'example-project',
        owner: 'example',
        description: 'Example project for demonstration',
        created_at: new Date().toISOString(),
      },
    ],
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// 处理认证状态
async function handleAuthStatus(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  return new Response(JSON.stringify({
    authenticated: false,
    message: 'Authentication service placeholder',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// 处理认证验证
async function handleAuthValidate(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  return new Response(JSON.stringify({
    valid: true,
    message: 'Token validation placeholder',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// 处理语言配置
async function handleLangConfig(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  return new Response(JSON.stringify({
    languages: ['en', 'es', 'fr', 'ja', 'kr', 'pt-br', 'ru', 'vi', 'zh-tw', 'zh'],
    default: 'en',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// 处理 Wiki 缓存
async function handleWikiCache(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const url = new URL(request.url);
  const cacheKey = url.pathname.replace('/api/wiki_cache/', '');

  if (request.method === 'GET') {
    // 从 KV 缓存获取数据
    if (env.CACHE_KV) {
      const cached = await env.CACHE_KV.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Cache not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'POST') {
    // 存储到 KV 缓存
    const body = await request.text();
    if (env.CACHE_KV) {
      await env.CACHE_KV.put(cacheKey, body, { expirationTtl: 3600 }); // 1小时过期
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// 处理 Wiki 导出
async function handleExportWiki(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  return new Response(JSON.stringify({
    message: 'Export functionality placeholder',
    format: 'markdown',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// 处理本地仓库结构
async function handleLocalRepoStructure(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  return new Response(JSON.stringify({
    structure: {
      type: 'directory',
      name: 'repository',
      children: [],
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}