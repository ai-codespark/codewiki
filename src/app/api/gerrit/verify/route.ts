import { NextRequest, NextResponse } from "next/server";

/**
 * Verifies if a URL points to a Gerrit project by calling the /config/server/version endpoint.
 * This is done server-side to avoid CORS issues.
 *
 * Reference: https://gerrit-documentation.storage.googleapis.com/Documentation/3.13.1/rest-api-config.html#get-version
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Extract the base URL (protocol + hostname + port)
    let baseUrl: string;
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      baseUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // According to Gerrit REST API documentation, the endpoint is GET /config/server/version
    // Some Gerrit servers may require /a/ prefix for REST API calls, so we try both
    // Reference: https://gerrit-documentation.storage.googleapis.com/Documentation/3.13.1/rest-api-config.html#get-version
    const endpointsToTry = [
      `${baseUrl}/config/server/version`,  // Standard endpoint (per documentation)
      `${baseUrl}/a/config/server/version`, // With /a/ prefix (some servers require this)
    ];

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout (increased for network issues)

    let lastError: Error | null = null;

    for (const versionEndpoint of endpointsToTry) {
      try {
        // Make a GET request to verify if it's a Gerrit server
        const response = await fetch(versionEndpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          // If 404 or 403, try the next endpoint (might be at different path)
          if ((response.status === 404 || response.status === 403) &&
              endpointsToTry.indexOf(versionEndpoint) < endpointsToTry.length - 1) {
            console.log(`Endpoint ${versionEndpoint} returned ${response.status}, trying next...`);
            continue;
          }
          // For other errors, log and try next endpoint if available
          if (endpointsToTry.indexOf(versionEndpoint) < endpointsToTry.length - 1) {
            console.log(`Endpoint ${versionEndpoint} returned ${response.status}, trying next...`);
            continue;
          }
          // Last endpoint failed, return failure
          clearTimeout(timeoutId);
          return NextResponse.json(
            { isGerrit: false, reason: `HTTP ${response.status}: ${response.statusText}`, triedEndpoints: endpointsToTry }
          );
        }

        // Check if the response is valid JSON (Gerrit returns JSON)
        const text = await response.text();

        if (!text || text.trim().length === 0) {
          // Try next endpoint if this one returned empty
          if (endpointsToTry.indexOf(versionEndpoint) < endpointsToTry.length - 1) {
            continue;
          }
          clearTimeout(timeoutId);
          return NextResponse.json(
            { isGerrit: false, reason: 'Empty response' }
          );
        }

        // Gerrit responses start with )]}' to prevent XSSI, so we need to strip it
        // According to documentation: https://gerrit-documentation.storage.googleapis.com/Documentation/3.13.1/rest-api-config.html#get-version
        // The actual response format is: )]}'\n\n"version" (version string) or )]}'\n\n{...} (VersionInfo object with ?verbose)
        // Example: )]}'\n\n"2.7"
        let cleanedText = text;
        if (cleanedText.startsWith(")]}'")) {
          // Remove the XSSI prefix (4 characters) and any following whitespace/newlines
          cleanedText = cleanedText.slice(4);
          // Trim leading whitespace and newlines
          cleanedText = cleanedText.trimStart();
        } else {
          // If no XSSI prefix, just trim
          cleanedText = cleanedText.trim();
        }

        // Log for debugging
        console.log(`Gerrit verification response from ${versionEndpoint}:`, cleanedText.substring(0, 100));

        // If after cleaning we have nothing, try next endpoint
        if (!cleanedText || cleanedText.length === 0) {
          if (endpointsToTry.indexOf(versionEndpoint) < endpointsToTry.length - 1) {
            continue;
          }
          clearTimeout(timeoutId);
          return NextResponse.json(
            { isGerrit: false, reason: 'No content after removing XSSI prefix' }
          );
        }

        // Try to parse as JSON - Gerrit returns either a version string or VersionInfo object
        // The response format is: "2.7" (a JSON string) or {...} (VersionInfo object)
        try {
          const data = JSON.parse(cleanedText);
          // If we can parse JSON and got a response, it's likely a Gerrit server
          // The response can be a string (version like "2.7") or an object (VersionInfo)
          const isValid = typeof data === 'string' || (typeof data === 'object' && data !== null);

          if (isValid) {
            clearTimeout(timeoutId);
            console.log(`Successfully verified Gerrit server, version: ${typeof data === 'string' ? data : data.gerrit_version || 'unknown'}`);
            return NextResponse.json({
              isGerrit: true,
              version: typeof data === 'string' ? data : data.gerrit_version || 'unknown',
            });
          } else {
            // Valid JSON but not a valid Gerrit response format
            console.log(`Parsed JSON but format is invalid:`, data);
            if (endpointsToTry.indexOf(versionEndpoint) < endpointsToTry.length - 1) {
              continue;
            }
            clearTimeout(timeoutId);
            return NextResponse.json(
              {
                isGerrit: false,
                reason: 'Response format is not a valid Gerrit version',
                details: `Expected string or object, got: ${typeof data}`
              }
            );
          }
        } catch (parseError) {
          // If parsing fails, log the actual text for debugging
          console.log(`Failed to parse JSON. Text was: "${cleanedText}"`);
          // If parsing fails, try next endpoint
          if (endpointsToTry.indexOf(versionEndpoint) < endpointsToTry.length - 1) {
            continue;
          }
          clearTimeout(timeoutId);
          return NextResponse.json(
            {
              isGerrit: false,
              reason: 'Failed to parse as JSON',
              details: parseError instanceof Error ? parseError.message : String(parseError),
              responseText: cleanedText.substring(0, 200) // Include first 200 chars for debugging
            }
          );
        }
      } catch (fetchError) {
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        const errorMessage = lastError.message;
        const errorName = lastError instanceof Error ? lastError.name : 'Unknown';

        console.log(`Error fetching ${versionEndpoint}: ${errorName} - ${errorMessage}`);

        // Check for specific error types
        const isNetworkError = errorMessage.includes('fetch failed') ||
                              errorMessage.includes('ECONNREFUSED') ||
                              errorMessage.includes('ENOTFOUND') ||
                              errorMessage.includes('ETIMEDOUT') ||
                              errorName === 'TypeError' ||
                              errorName === 'NetworkError';

        // If it's a network error and we have more endpoints to try, continue
        if (isNetworkError && endpointsToTry.indexOf(versionEndpoint) < endpointsToTry.length - 1) {
          console.log(`Network error for ${versionEndpoint}, trying next endpoint...`);
          continue;
        }

        // If it's not a timeout and we have more endpoints to try, continue
        if (!errorMessage.includes('aborted') && !errorMessage.includes('timeout') &&
            endpointsToTry.indexOf(versionEndpoint) < endpointsToTry.length - 1) {
          continue;
        }

        // If it's a timeout or last endpoint, return error
        clearTimeout(timeoutId);

        if (errorMessage.includes('aborted') || errorMessage.includes('timeout')) {
          return NextResponse.json(
            {
              isGerrit: false,
              reason: 'Request timeout',
              triedEndpoints: endpointsToTry,
              error: errorMessage
            }
          );
        }

        // If this is the last endpoint, return the error with more details
        if (endpointsToTry.indexOf(versionEndpoint) >= endpointsToTry.length - 1) {
          return NextResponse.json(
            {
              isGerrit: false,
              reason: isNetworkError ? 'Network connection failed. The server may be unreachable, require authentication, or the endpoint may not exist.' : 'Network error',
              details: errorMessage,
              errorName: errorName,
              triedEndpoints: endpointsToTry
            }
          );
        }
      }
    }

    // If we've tried all endpoints and none worked
    clearTimeout(timeoutId);
    return NextResponse.json(
      {
        isGerrit: false,
        reason: 'Could not verify Gerrit server',
        details: lastError ? lastError.message : 'All endpoints failed'
      }
    );
  } catch (error) {
    console.error('Error in Gerrit verification:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

