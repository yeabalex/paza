const API_BASE_URL = '/api/v1';

type TokenProvider = () => Promise<string | null>;

let authTokenProvider: TokenProvider | null = null;

export function setAuthTokenProvider(provider: TokenProvider | null): void {
  authTokenProvider = provider;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  let token: string | null = null;

  if (authTokenProvider) {
    try {
      token = await authTokenProvider();
    } catch (err) {
      console.warn('[PAZA AUTH] Failed to retrieve Clerk session token:', err);
    }
  }

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}, retries = 2): Promise<T | null> {
  const authHeaders = await getAuthHeaders();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...authHeaders,
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.error(`[PAZA API] HTTP ${res.status} at ${endpoint} (attempt ${attempt + 1})`);
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          return null;
        }
        if (attempt < retries) continue;
        return null;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.error(`[PAZA API] Non-JSON response at ${endpoint} (content-type: ${contentType}):`, text.substring(0, 200));
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        return null;
      }

      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(`[PAZA API] Fetch error at ${endpoint} (attempt ${attempt + 1}):`, err);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      return null;
    }
  }
  return null;
}
