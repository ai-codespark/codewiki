import { NextResponse } from "next/server";

export const runtime = 'edge';

const TARGET_SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';

export async function GET() {
  try {
    // Check if SERVER_BASE_URL is configured
    if (!process.env.SERVER_BASE_URL && TARGET_SERVER_BASE_URL === 'http://localhost:8001') {
      console.warn('SERVER_BASE_URL not set, using default localhost. This may fail in production.');
      return NextResponse.json(
        {
          auth_required: false,
          error: 'SERVER_BASE_URL environment variable is not configured. Please set it in Cloudflare Pages settings.',
          serverBaseUrl: TARGET_SERVER_BASE_URL,
        },
        { status: 200 }
      );
    }

    // Forward the request to the backend API
    const response = await fetch(`${TARGET_SERVER_BASE_URL}/auth/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error(`Backend auth/status returned ${response.status} from ${TARGET_SERVER_BASE_URL}: ${errorText}`);

      // If it's a 403, provide more helpful error message
      if (response.status === 403) {
        return NextResponse.json(
          {
            auth_required: false,
            error: `Backend returned 403 Forbidden. This may indicate CORS issues or the backend requires authentication. Check SERVER_BASE_URL: ${TARGET_SERVER_BASE_URL}`,
            serverBaseUrl: TARGET_SERVER_BASE_URL,
            status: response.status,
          },
          { status: 200 } // Return 200 to prevent frontend breakage
        );
      }

      return NextResponse.json(
        {
          auth_required: false,
          error: `Backend server returned ${response.status}: ${errorText}`,
          serverBaseUrl: TARGET_SERVER_BASE_URL,
          status: response.status,
        },
        { status: 200 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error forwarding request to backend:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's a timeout or network error
    if (errorMessage.includes('timeout') || errorMessage.includes('fetch')) {
      return NextResponse.json(
        {
          auth_required: false,
          error: `Cannot reach backend at ${TARGET_SERVER_BASE_URL}. Please verify SERVER_BASE_URL is correct and the backend is running.`,
          serverBaseUrl: TARGET_SERVER_BASE_URL,
          connectionError: errorMessage,
        },
        { status: 200 }
      );
    }

    // Return a default response if backend is unreachable
    return NextResponse.json(
      {
        auth_required: false,
        error: `Backend unreachable: ${errorMessage}. Please check SERVER_BASE_URL configuration.`,
        serverBaseUrl: TARGET_SERVER_BASE_URL,
      },
      { status: 200 }
    );
  }
}
