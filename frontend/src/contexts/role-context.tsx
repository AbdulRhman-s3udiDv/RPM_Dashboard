import type { Role } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

export type { Role };

export const ROLE_META: Record<Role, { label: string; short: string; tagline: string }> = {
  super_admin: { label: 'Super Admin', short: 'RPMCares HQ', tagline: 'Platform-wide command' },
  clinic_admin: { label: 'Clinic Admin', short: 'Clinic Lead', tagline: 'Single-clinic oversight' },
  staff: { label: 'Care Staff', short: 'MA / Nurse / CC', tagline: 'Calls, alerts & docs' },
};

/** Role is derived from the authenticated session — there is no manual role switcher anymore. */
export function useRole() {
  const { session } = useAuth();
  if (!session) throw new Error('useRole must be used while authenticated');
  return { role: session.user.role };
}
