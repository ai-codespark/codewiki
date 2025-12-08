export function extractUrlDomain(input: string): string | null {
    try {
        const normalizedInput = input.startsWith('http') ? input : `https://${input}`;
        const url = new URL(normalizedInput);
        return `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}`; // Inclut le protocole et le domaine
    } catch {
        return null; // Not a valid URL
    }
}

export function extractUrlPath(input: string): string | null {
    try {
        const normalizedInput = input.startsWith('http') ? input : `https://${input}`;
        const url = new URL(normalizedInput);
        return url.pathname.replace(/^\/|\/$/g, ''); // Remove leading and trailing slashes
    } catch {
        return null; // Not a valid URL
    }
}

/**
 * Verifies if a URL points to a Gerrit project by calling the /config/server/version endpoint.
 * Uses a server-side API route to avoid CORS issues.
 * According to Gerrit REST API documentation: https://gerrit-documentation.storage.googleapis.com/Documentation/3.13.1/rest-api-config.html#get-version
 *
 * @param input - The repository URL to verify
 * @returns Promise<boolean> - true if the URL is a Gerrit project, false otherwise
 */
export async function verifyGerritProject(input: string): Promise<boolean> {
    try {
        // Use server-side API route to avoid CORS issues
        const response = await fetch('/api/gerrit/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: input }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.debug(`Gerrit verification API returned status ${response.status}:`, errorData);
            return false;
        }

        const data = await response.json();
        console.debug('Gerrit verification response:', data);
        return data.isGerrit === true;
    } catch (error) {
        // Any error means verification failed
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.debug('Gerrit verification failed:', errorMessage);
        return false;
    }
}