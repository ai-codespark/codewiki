import { NextResponse } from 'next/server';

const TARGET_SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const targetUrl = `${TARGET_SERVER_BASE_URL}/litellm/test-connection`;

    // Make the actual request to the backend service
    const backendResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // If the backend service responds with an error
    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        errorData,
        { status: backendResponse.status }
      );
    }

    // Forward the response from the backend
    const result = await backendResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing LiteLLM connection:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS if needed
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

