import { NextResponse } from 'next/server';

// The target backend server base URL, derived from environment variable or defaulted.
const TARGET_SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://127.0.0.1:8001';

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await params;
    const targetUrl = `${TARGET_SERVER_BASE_URL}/models/${provider}/dynamic`;

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
      const models = JSON.parse(responseText);

      // If the backend service responds with an error status but valid JSON
      if (!backendResponse.ok) {
        console.warn(`Backend service responded with status: ${backendResponse.status}, but returning data anyway`);
      }

      return NextResponse.json(models);
    } catch {
      // If response is not valid JSON, return error
      console.error('Backend response is not valid JSON:', responseText);
      return NextResponse.json(
        { error: `Invalid response from backend service: ${responseText}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching dynamic models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dynamic models from backend' },
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
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}