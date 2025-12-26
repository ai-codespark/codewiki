import { NextResponse } from 'next/server';

export const runtime = 'edge';

// The target backend server base URL, derived from environment variable or defaulted.
const TARGET_SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';

export async function GET() {
  try {
    // Check if SERVER_BASE_URL is configured
    if (!process.env.SERVER_BASE_URL && TARGET_SERVER_BASE_URL === 'http://localhost:8001') {
      console.warn('SERVER_BASE_URL not set, using default localhost. This may fail in production.');
      return NextResponse.json(
        {
          error: 'SERVER_BASE_URL environment variable is not configured. Please set it in Cloudflare Pages settings.',
          providers: [],
          defaultProvider: "google",
          serverBaseUrl: TARGET_SERVER_BASE_URL,
        },
        { status: 200 }
      );
    }

    const targetUrl = `${TARGET_SERVER_BASE_URL}/models/config`;

    // Make the actual request to the backend service
    const backendResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    // If the backend service responds with an error
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => 'No error details');
      console.error(`Backend models/config returned ${backendResponse.status} from ${TARGET_SERVER_BASE_URL}: ${errorText}`);

      // If it's a 403, provide more helpful error message
      if (backendResponse.status === 403) {
        return NextResponse.json(
          {
            error: `Backend returned 403 Forbidden. Check SERVER_BASE_URL: ${TARGET_SERVER_BASE_URL}. This may indicate CORS issues.`,
            providers: [],
            defaultProvider: "google",
            serverBaseUrl: TARGET_SERVER_BASE_URL,
            status: backendResponse.status,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          error: `Backend service responded with status: ${backendResponse.status}: ${errorText}`,
          providers: [],
          defaultProvider: "google",
          serverBaseUrl: TARGET_SERVER_BASE_URL,
          status: backendResponse.status,
        },
        { status: 200 }
      );
    }

    // Forward the response from the backend
    const modelConfig = await backendResponse.json();
    return NextResponse.json(modelConfig);
  } catch (error) {
    console.error('Error fetching model configurations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's a timeout or network error
    if (errorMessage.includes('timeout') || errorMessage.includes('fetch')) {
      return NextResponse.json(
        {
          error: `Cannot reach backend at ${TARGET_SERVER_BASE_URL}. Please verify SERVER_BASE_URL is correct.`,
          providers: [],
          defaultProvider: "google",
          serverBaseUrl: TARGET_SERVER_BASE_URL,
          connectionError: errorMessage,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        error: `Backend unreachable: ${errorMessage}. Please check SERVER_BASE_URL configuration.`,
        providers: [],
        defaultProvider: "google",
        serverBaseUrl: TARGET_SERVER_BASE_URL,
      },
      { status: 200 }
    );
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
