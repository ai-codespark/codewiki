import { NextRequest, NextResponse } from "next/server";

const TARGET_SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';

/**
 * Fetches the repository structure (file tree and README) for a Gerrit project.
 * This endpoint proxies the request to the backend API which clones the repo
 * and returns the file structure.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repo_url, gerrit_user, token } = body;

    if (!repo_url) {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 }
      );
    }

    // Call the backend API to get the repository structure
    // The backend will clone the repo if needed and return the file tree
    const response = await fetch(`${TARGET_SERVER_BASE_URL}/api/gerrit/structure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repo_url,
        gerrit_user,
        token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorBody;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { error: errorText };
      }
      return NextResponse.json(errorBody, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error forwarding Gerrit structure request to backend:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during Gerrit structure retrieval' },
      { status: 500 }
    );
  }
}