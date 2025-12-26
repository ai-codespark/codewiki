import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// The target backend server base URL, derived from environment variable or defaulted.
// This should match the logic in your frontend's page.tsx for consistency.
const TARGET_SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';

// This is a fallback HTTP implementation that will be used if WebSockets are not available
// or if there's an error with the WebSocket connection
export async function POST(req: NextRequest) {
  try {
    const requestBody = await req.json(); // Assuming the frontend sends JSON

    // Note: This endpoint now uses the HTTP fallback instead of WebSockets
    // The WebSocket implementation is in src/utils/websocketClient.ts
    // This HTTP endpoint is kept for backward compatibility
    console.log('Using HTTP fallback for chat completion instead of WebSockets');

    const targetUrl = `${TARGET_SERVER_BASE_URL}/chat/completions/stream`;

    // Make the actual request to the backend service
    let backendResponse: Response;
    try {
      backendResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream', // Indicate that we expect a stream
        },
        body: JSON.stringify(requestBody),
      });
    } catch (fetchError) {
      console.error('Failed to connect to backend server:', fetchError);
      const errorMessage = fetchError instanceof Error
        ? fetchError.message
        : 'Unknown error';

      // Check if it's a connection error
      if (errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('Failed to fetch')) {
        return new NextResponse(
          JSON.stringify({
            error: `Cannot connect to backend server at ${TARGET_SERVER_BASE_URL}. Please ensure the server is running.`,
            details: errorMessage
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new NextResponse(
        JSON.stringify({
          error: 'Failed to connect to backend server',
          details: errorMessage
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // If the backend service returned an error, forward that error to the client
    if (!backendResponse.ok) {
      let errorBody: string;
      try {
        errorBody = await backendResponse.text();
      } catch {
        errorBody = `Backend server returned status ${backendResponse.status}: ${backendResponse.statusText}`;
      }

      const errorHeaders = new Headers();
      backendResponse.headers.forEach((value, key) => {
        errorHeaders.set(key, value);
      });

      // Provide more helpful error messages
      let errorMessage = errorBody;
      if (backendResponse.status === 500) {
        errorMessage = `Backend server error (500): ${errorBody || 'Internal server error. Please check the backend server logs.'}`;
      } else if (backendResponse.status === 503) {
        errorMessage = `Backend server unavailable (503): ${errorBody || 'The backend server is temporarily unavailable.'}`;
      }

      return new NextResponse(
        JSON.stringify({ error: errorMessage }),
        {
          status: backendResponse.status,
          statusText: backendResponse.statusText,
          headers: { 'Content-Type': 'application/json', ...Object.fromEntries(errorHeaders) },
        }
      );
    }

    // Ensure the backend response has a body to stream
    if (!backendResponse.body) {
      return new NextResponse('Stream body from backend is null', { status: 500 });
    }

    // Create a new ReadableStream to pipe the data from the backend to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = backendResponse.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            controller.enqueue(value);
          }
        } catch (error) {
          console.error('Error reading from backend stream in proxy:', error);
          controller.error(error);
        } finally {
          controller.close();
          reader.releaseLock(); // Important to release the lock on the reader
        }
      },
      cancel(reason) {
        console.log('Client cancelled stream request:', reason);
      }
    });

    // Set up headers for the response to the client
    const responseHeaders = new Headers();
    // Copy the Content-Type from the backend response (e.g., 'text/event-stream')
    const contentType = backendResponse.headers.get('Content-Type');
    if (contentType) {
      responseHeaders.set('Content-Type', contentType);
    }
    // It's good practice for streams not to be cached or transformed by intermediaries.
    responseHeaders.set('Cache-Control', 'no-cache, no-transform');

    return new NextResponse(stream, {
      status: backendResponse.status, // Should be 200 for a successful stream start
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Error in API proxy route (/api/chat/stream):', error);
    let errorMessage = 'Internal Server Error in proxy';
    let errorDetails = '';

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || '';
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    // Provide more context about the error
    const errorResponse = {
      error: errorMessage,
      details: errorDetails,
      hint: 'This may be due to a network issue, backend server being down, or a configuration problem. Please check that the backend server is running and accessible.'
    };

    return new NextResponse(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Optional: Handle OPTIONS requests for CORS if you ever call this from a different origin
// or use custom headers that trigger preflight requests. For same-origin, it's less critical.
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204, // No Content
    headers: {
      'Access-Control-Allow-Origin': '*', // Be more specific in production if needed
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Adjust as per client's request headers
    },
  });
}