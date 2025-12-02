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

    // Construct the Gerrit REST API endpoint for version check
    const versionEndpoint = `${baseUrl}/config/server/version`;

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      // Make a GET request to verify if it's a Gerrit server
      const response = await fetch(versionEndpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(
          { isGerrit: false, reason: `HTTP ${response.status}: ${response.statusText}` }
        );
      }

      // Check if the response is valid JSON (Gerrit returns JSON)
      const text = await response.text();

      if (!text || text.trim().length === 0) {
        return NextResponse.json(
          { isGerrit: false, reason: 'Empty response' }
        );
      }

      // Gerrit responses start with )]}' to prevent XSSI, so we need to strip it
      // The format is: )]}'\n"version" or )]}'\n{...}
      let cleanedText = text.trim();
      if (cleanedText.startsWith(")]}'")) {
        // Remove the XSSI prefix (4 characters) and any following whitespace/newlines
        cleanedText = cleanedText.slice(4).trim();
      }

      // If after cleaning we have nothing, it's not a valid Gerrit response
      if (!cleanedText || cleanedText.length === 0) {
        return NextResponse.json(
          { isGerrit: false, reason: 'No content after removing XSSI prefix' }
        );
      }

      // Try to parse as JSON - Gerrit returns either a version string or VersionInfo object
      try {
        const data = JSON.parse(cleanedText);
        // If we can parse JSON and got a response, it's likely a Gerrit server
        // The response can be a string (version) or an object (VersionInfo)
        const isValid = typeof data === 'string' || (typeof data === 'object' && data !== null);

        return NextResponse.json({
          isGerrit: isValid,
          version: typeof data === 'string' ? data : data.gerrit_version || 'unknown',
        });
      } catch (parseError) {
        return NextResponse.json(
          {
            isGerrit: false,
            reason: 'Failed to parse as JSON',
            details: parseError instanceof Error ? parseError.message : String(parseError)
          }
        );
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);

      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);

      // Check if it's a timeout
      if (errorMessage.includes('aborted') || errorMessage.includes('timeout')) {
        return NextResponse.json(
          { isGerrit: false, reason: 'Request timeout' }
        );
      }

      return NextResponse.json(
        {
          isGerrit: false,
          reason: 'Network error',
          details: errorMessage
        }
      );
    }
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

