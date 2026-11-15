import { useEffect, useState } from 'react';
import { acceptInvitationSchema, type AcceptInvitationInput } from '@sanjeevani/shared/schemas/profile';
export const ROUTES = ['home', 'login', 'account', 'connect', 'assistant', 'medications', 'appointments', 'pill-check'] as const;
export type Route = typeof ROUTES[number];
export function readRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  return ROUTES.find((route) => route === path) ?? 'home';
}
export function navigate(route: Route): void { window.location.hash = `/${route}`; }
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => typeof window === 'undefined' ? 'home' : readRoute(window.location.hash));
  useEffect(() => {
    const changed = () => { setRoute(readRoute(window.location.hash)); if (window.location.hash.startsWith('#/')) window.scrollTo(0, 0); };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  return route;
}
export function parseInvitation(hash: string): AcceptInvitationInput | null {
  const params = new URLSearchParams(hash.split('?')[1] ?? '');
  const result = acceptInvitationSchema.safeParse({ profileId: params.get('profileId'), invitationId: params.get('invitationId'), token: params.get('token') });
  return result.success ? result.data : null;
}
/** Session-only storage preserves a link during verification, never in public URL query logs. */
export function rememberInvitation(): void {
  const input = parseInvitation(window.location.hash);
  if (input) { try { sessionStorage.setItem('sanjeevani:invitation', JSON.stringify(input)); } catch { /* The original fragment still works. */ } }
}
export function pendingInvitation(): AcceptInvitationInput | null {
  if (typeof window === 'undefined') return null;
  const current = parseInvitation(window.location.hash);
  if (current) return current;
  try { const result = acceptInvitationSchema.safeParse(JSON.parse(sessionStorage.getItem('sanjeevani:invitation') ?? 'null')); return result.success ? result.data : null; } catch { return null; }
}
