const API_BASE_URL = '/api/v1';

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}, retries = 2): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.error(`[PAZA API] HTTP ${res.status} at ${endpoint} (attempt ${attempt + 1})`);
        if (attempt < retries) continue;
        return null;
      }

      // Check content-type to detect ngrok interstitial HTML
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.error(`[PAZA API] Non-JSON response at ${endpoint} (content-type: ${contentType}):`, text.substring(0, 200));
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        return null;
      }

      const data = await res.json();
      if (attempt > 0) {
        console.log(`[PAZA API] Success on retry ${attempt} for ${endpoint}`);
      }
      return data as T;
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(`[PAZA API] Fetch error at ${endpoint} (attempt ${attempt + 1}):`, err);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      return null;
    }
  }
  return null;
}
