import { Injectable, signal } from '@angular/core';
import { requestJson, ApiError } from './supabase';

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
}

type AuthResponse = Partial<Session> & { expires_in?: number };
const sessionKey = 'field-tracker-session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private session = this.restoreSession();
  readonly user = signal(this.session?.user ?? null);
  private refreshing: Promise<string> | null = null;

  async signIn(email: string, password: string): Promise<void> {
    const data = await requestJson<AuthResponse>('/auth/v1/token?grant_type=password', {
      method: 'POST', body: JSON.stringify({ email: email.trim(), password }),
    });
    this.saveSession(data);
  }

  async register(email: string, password: string): Promise<void> {
    const data = await requestJson<AuthResponse>('/auth/v1/signup', {
      method: 'POST', body: JSON.stringify({ email: email.trim(), password }),
    });
    if (!data.access_token) {
      throw new Error('Registration needs email confirmation. Ask the project owner to turn off Confirm email, or confirm your email before signing in.');
    }
    this.saveSession(data);
  }

  async accessToken(): Promise<string> {
    if (!this.session) throw new Error('Sign in to save and load your trips.');
    if (this.session.expires_at > Date.now() / 1000 + 60) return this.session.access_token;
    if (!this.refreshing) {
      this.refreshing = this.refreshSession().finally(() => this.refreshing = null);
    }
    return this.refreshing;
  }

  async signOut(): Promise<void> {
    const token = this.session?.access_token;
    this.session = null;
    this.user.set(null);
    localStorage.removeItem(sessionKey);
    if (token) {
      // An offline sign-out still clears this device's session immediately.
      await requestJson('/auth/v1/logout?scope=local', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
  }

  private async refreshSession(): Promise<string> {
    const refreshToken = this.session!.refresh_token;
    try {
      const data = await requestJson<AuthResponse>('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (this.session?.refresh_token !== refreshToken) throw new Error('The signed-in account changed. Try again.');
      this.saveSession(data);
      return this.session!.access_token;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
        throw new Error('Your session expired. Sign out and sign back in to sync this phone’s saved trips.');
      }
      throw error;
    }
  }

  private saveSession(data: AuthResponse): void {
    if (!data.access_token || !data.refresh_token || !data.user) throw new Error('The server did not return a sign-in session.');
    const session: Session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at ?? Date.now() / 1000 + (data.expires_in ?? 3600),
      user: data.user,
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));
    this.session = session;
    this.user.set(session.user);
  }

  private restoreSession(): Session | null {
    try {
      const data = JSON.parse(localStorage.getItem(sessionKey) ?? 'null') as Session | null;
      return data?.user?.id && data.access_token && data.refresh_token && Number.isFinite(data.expires_at) ? data : null;
    } catch { return null; }
  }
}
