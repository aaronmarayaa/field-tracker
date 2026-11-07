export const supabaseUrl = 'https://agvadccmdkfdclstamkg.supabase.co';
export const publishableKey = 'sb_publishable_JHDcV3M06w8yC8oa2DS8RA_tAL3tr_I';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(supabaseUrl + path, {
      ...options,
      headers: { apikey: publishableKey, 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
    });
    const body = await response.text();
    const data = body ? JSON.parse(body) : null;
    if (!response.ok) {
      throw new ApiError(data?.msg || data?.error_description || data?.message || 'The request could not complete.', response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error('Could not reach the server. Check your internet connection and try again.');
  } finally {
    clearTimeout(timeout);
  }
}
