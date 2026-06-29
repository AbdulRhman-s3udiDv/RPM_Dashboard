const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Role = 'super_admin' | 'clinic_admin' | 'staff';

export type ApiUser = { id: string; email: string; role: Role; name: string; clinicId: string | null };

export type LoginResponse = { token: string; refreshToken: string; expiresAt: number; user: ApiUser };

export type Member = {
  id: string;
  email: string;
  role: Role;
  name: string;
  clinic_id: string | null;
  created_at: string;
};

export type Clinic = {
  id: string;
  name: string;
  specialty: string | null;
  location: string | null;
  created_at: string;
};

export type SmartMeterAlert = {
  alert_id: number;
  patient_name: string;
  patient_id: number;
  alert_date: string;
  alert_type: string;
  alert_threshold: number;
  reading_value: number;
};

export type ClinicBreakdownItem = {
  name: string;
  totalPatients: number;
  complianceRate: number;
  unreadAlerts: number;
  openTasks: number;
};

export type DashboardSummary = {
  tenovi: { totalDevices: number; activeGateways: number; totalPatients: number };
  smartmeter: {
    totalPatients: number;
    unreadAlerts: number;
    openTasks: number;
    complianceRate: number;
    compliance20min: number;
    billingReadiness: number;
    reviewTimeMinutes: number;
    topAlerts: SmartMeterAlert[];
    clinicBreakdown: ClinicBreakdownItem[];
  };
};

export type AlertStatus = 'open' | 'assigned' | 'escalated' | 'resolved';

export type AlertEvent = {
  id: string;
  timestamp: string | null;
  patient_id: string;
  patient_name: string;
  clinic_name: string;
  alert_type: string;
  tier: string;
  value: string | null;
  unit: string | null;
  threshold: string | null;
  device_type: string | null;
  reading_id: string | null;
  reading_time: string | null;
  provider_email: string | null;
  sms_sent: string | null;
  email_sent: string | null;
  status: AlertStatus;
  assigned_to: string | null;
  assignee: { id: string; name: string; email: string } | null;
  resolved_at: string | null;
  created_at: string;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(`Could not reach the server at ${API_URL}.`, 0);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: (token: string) => request<{ user: ApiUser }>('/api/auth/me', { method: 'GET' }, token),

  listMembers: (token: string) => request<{ members: Member[] }>('/api/admin/members', { method: 'GET' }, token),
  inviteMember: (
    token: string,
    payload: { email: string; name: string; role: 'clinic_admin' | 'staff'; clinicId: string },
  ) =>
    request<{ ok: true }>(
      '/api/admin/members/invite',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
  removeMember: (token: string, id: string) =>
    request<{ ok: true }>(`/api/admin/members/${id}`, { method: 'DELETE' }, token),

  listClinics: (token: string) => request<{ clinics: Clinic[] }>('/api/clinics', { method: 'GET' }, token),
  createClinic: (token: string, name: string) =>
    request<{ clinic: Clinic }>('/api/clinics', { method: 'POST', body: JSON.stringify({ name }) }, token),
  deleteClinic: (token: string, id: string) =>
    request<void>(`/api/clinics/${id}`, { method: 'DELETE' }, token),

  patchMe: (token: string, payload: { name?: string; email?: string; password?: string }) =>
    request<{ user: ApiUser }>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(payload) }, token),

  listAlerts: (token: string, params?: { clinic?: string; status?: string }) => {
    const qs = params && Object.keys(params).length
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    return request<{ alerts: AlertEvent[] }>(`/api/alerts${qs}`, { method: 'GET' }, token);
  },
  updateAlert: (token: string, id: string, patch: { status?: AlertStatus; assignedTo?: string | null }) =>
    request<{ alert: AlertEvent }>(`/api/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, token),

  getDashboardSummary: (token: string) =>
    request<DashboardSummary>('/api/dashboard/summary', { method: 'GET' }, token),

  getClinicBreakdown: (token: string) =>
    request<{ breakdown: ClinicBreakdownItem[] }>('/api/clinics/breakdown', { method: 'GET' }, token),
};
