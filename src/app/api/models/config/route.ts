import { NextResponse } from 'next/server';

// The target backend server base URL, derived from environment variable or defaulted.
const TARGET_SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';

// Check if we're running in Cloudflare environment
const IS_CLOUDFLARE = process.env.CF_PAGES === '1' || process.env.NODE_ENV === 'production';

// Default model configuration for Cloudflare deployment
const CLOUDFLARE_DEFAULT_CONFIG = {
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "models": [
        {"id": "gpt-4o", "name": "GPT-4o"},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini"}
      ],
      "supportsCustomModel": true
    },
    {
      "id": "google",
      "name": "Google",
      "models": [
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro"},
        {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash"}
      ],
      "supportsCustomModel": true
    },
    {
      "id": "litellm",
      "name": "LiteLLM",
      "models": [
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"}
      ],
      "supportsCustomModel": true
    }
  ],
  "defaultProvider": "openai"
};

export async function GET() {
  try {
    // For Cloudflare deployment, always return default configuration
    if (IS_CLOUDFLARE || TARGET_SERVER_BASE_URL === 'http://localhost:8001') {
      console.log('Cloudflare deployment detected, returning default model configuration');
      return NextResponse.json(CLOUDFLARE_DEFAULT_CONFIG);
    }

    const targetUrl = `${TARGET_SERVER_BASE_URL}/models/config`;

    // Make the actual request to the backend service
    const backendResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    // Always try to parse the response as JSON, regardless of status code
    const responseText = await backendResponse.text();

    try {
      const modelConfig = JSON.parse(responseText);

      // If the backend service responds with an error status but valid JSON
      if (!backendResponse.ok) {
        console.warn(`Backend service responded with status: ${backendResponse.status}, but returning data anyway`);
      }

      return NextResponse.json(modelConfig);
    } catch {
      // If response is not valid JSON, provide default configuration
      console.error('Backend response is not valid JSON, using default configuration:', responseText);
      return NextResponse.json(CLOUDFLARE_DEFAULT_CONFIG);
    }
  } catch (error) {
    console.error('Error fetching model configurations, using default:', error);
    return NextResponse.json(CLOUDFLARE_DEFAULT_CONFIG);
  }
}

// Handle OPTIONS requests for CORS if needed
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
