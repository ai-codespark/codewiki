import { NextResponse } from 'next/server';

// The target backend server base URL, derived from environment variable or defaulted.
const TARGET_SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';

export async function GET() {
  try {
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

      // Default model configuration
      const defaultConfig = {
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

      return NextResponse.json(defaultConfig);
    }
  } catch (error) {
    console.error('Error fetching model configurations, using default:', error);

    // Default model configuration when backend is unreachable
    const defaultConfig = {
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

    return NextResponse.json(defaultConfig);
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
