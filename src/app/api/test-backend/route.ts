import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Test endpoint to verify SERVER_BASE_URL configuration
export async function GET() {
  const TARGET_SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';

  const testInfo = {
    configured: !!process.env.SERVER_BASE_URL,
    serverBaseUrl: TARGET_SERVER_BASE_URL,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  };

  // Try to connect to the backend
  let connectionTest = {
    reachable: false,
    status: null as number | null,
    error: null as string | null,
  };

  try {
    // Try to reach the backend root endpoint
    const response = await fetch(`${TARGET_SERVER_BASE_URL}/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Add a short timeout
      signal: AbortSignal.timeout(5000),
    });

    connectionTest = {
      reachable: response.ok,
      status: response.status,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    connectionTest = {
      reachable: false,
      status: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  return NextResponse.json({
    ...testInfo,
    connection: connectionTest,
  });
}

