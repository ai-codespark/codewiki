import { NextResponse } from 'next/server';

export const runtime = 'edge';

// The target backend server base URL, derived from environment variable or defaulted.
const TARGET_SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';

export async function GET() {
  try {
    const targetUrl = `${TARGET_SERVER_BASE_URL}/lang/config`;

    // Make the actual request to the backend service
    const backendResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    // If the backend service responds with an error
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: `Backend service responded with status: ${backendResponse.status}` },
        { status: backendResponse.status }
      );
    }

    // Forward the response from the backend
    const langConfig = await backendResponse.json();
    return NextResponse.json(langConfig);
  } catch (error) {
    console.error('Error fetching language configuration:', error);

    // Return default language config if backend is unavailable
    const defaultConfig = {
      supported_languages: {
        "en": "English",
        "ja": "Japanese (日本語)",
        "zh": "Mandarin Chinese (中文)",
        "zh-tw": "Traditional Chinese (繁體中文)",
        "es": "Spanish (Español)",
        "kr": "Korean (한국어)",
        "vi": "Vietnamese (Tiếng Việt)",
        "pt-br": "Brazilian Portuguese (Português Brasileiro)",
        "fr": "Français (French)",
        "ru": "Русский (Russian)"
      },
      default: "en"
    };

    return NextResponse.json(defaultConfig, { status: 200 });
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

