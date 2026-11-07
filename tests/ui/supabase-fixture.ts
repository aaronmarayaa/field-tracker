import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

const project = 'https://agvadccmdkfdclstamkg.supabase.co';
const firstUser = { id: '11111111-1111-4111-8111-111111111111', email: 'runner@example.com' };
type User = typeof firstUser;
type Row = { id: string; user_id: string; started_at: string; unit: string; distance_meters: number; duration_seconds: number; route: unknown[]; background: number; [key: string]: unknown };

function session(user: User, expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  return { user, access_token: `access-${user.id}`, refresh_token: `refresh-${user.id}`, expires_at: expiresAt };
}

export async function mockSupabase(page: Page, signedIn = true, expired = false) {
  const accounts = new Map<string, { user: User; password: string }>([[firstUser.email, { user: firstUser, password: 'test-password-1' }]]);
  const rows = new Map<string, Row>();
  const writes: Row[] = [];
  let online = true;
  let refreshCount = 0;
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'apikey,authorization,content-type,prefer' };

  if (signedIn) await page.addInitScript((value) => {
    if (!localStorage.getItem('field-tracker-session')) localStorage.setItem('field-tracker-session', JSON.stringify(value));
  }, session(firstUser, expired ? 1 : undefined));

  await page.route(`${project}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const reply = (status: number, json?: unknown) => route.fulfill(json === undefined ? { status, headers } : { status, headers, json });
    if (method === 'OPTIONS') return reply(204);
    if (!online) return route.abort('internetdisconnected');
    if (url.pathname === '/auth/v1/signup') {
      const { email, password } = request.postDataJSON();
      if (accounts.has(email)) return reply(400, { msg: 'User already registered' });
      const user = { id: randomUUID(), email };
      accounts.set(email, { user, password });
      return reply(200, session(user));
    }
    if (url.pathname === '/auth/v1/token') {
      const body = request.postDataJSON();
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const account = [...accounts.values()].find(({ user }) => body.refresh_token === `refresh-${user.id}`);
        if (!account) return reply(400, { msg: 'Refresh token expired' });
        refreshCount++;
        return reply(200, session(account.user));
      }
      const account = accounts.get(body.email);
      return account && account.password === body.password ? reply(200, session(account.user)) : reply(400, { msg: 'Invalid login credentials' });
    }
    if (url.pathname === '/auth/v1/logout') return reply(204);
    if (url.pathname !== '/rest/v1/trips') return reply(404, { message: 'Unexpected REST request' });
    const token = request.headers()['authorization'];
    const owner = [...accounts.values()].find(({ user }) => token === `Bearer access-${user.id}`)?.user.id;
    if (!owner) return reply(401, { message: 'Authentication required' });
    if (method === 'POST') {
      const trip = request.postDataJSON() as Row;
      if (trip.user_id !== owner || (rows.has(trip.id) && rows.get(trip.id)?.user_id !== owner)) return reply(403, { message: 'Trip belongs to another user' });
      rows.set(trip.id, trip);
      writes.push(trip);
      return reply(201);
    }
    const start = Number(url.searchParams.get('offset') ?? 0);
    const ownRows = [...rows.values()].filter((trip) => trip.user_id === owner).sort((a, b) => b.started_at.localeCompare(a.started_at));
    return reply(200, ownRows.slice(start, start + Number(url.searchParams.get('limit') ?? 25)));
  });

  return { writes, rows, setOnline: (value: boolean) => { online = value; }, refreshCount: () => refreshCount };
}
