const configuredApiRoot = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const API_ROOT = configuredApiRoot.endsWith('/api') ? `${configuredApiRoot}/v1` : configuredApiRoot;
const CREDENTIALS_KEY = 'servicepro.credentials';

export type AuthResult = { email: string; roles: string[] };
export type PageResult<T> = { items: T[]; page: number; size: number; total: number };

export function storedCredentials(): { email: string; password: string; roles: string[] } | null {
  const stored = sessionStorage.getItem(CREDENTIALS_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as { email: string; password: string; roles: string[] };
  } catch {
    sessionStorage.removeItem(CREDENTIALS_KEY);
    return null;
  }
}

export function signOut() {
  sessionStorage.removeItem(CREDENTIALS_KEY);
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const response = await fetch(`${API_ROOT}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${email}:${password}`)}`,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || 'Sign-in failed. Check your credentials.');
  const auth = { email: data.email as string, password, roles: data.roles as string[] };
  sessionStorage.setItem(CREDENTIALS_KEY, JSON.stringify(auth));
  return auth;
}

export async function authStatus(): Promise<boolean> {
  const response = await fetch(`${API_ROOT}/auth/status`);
  if (!response.ok) throw new Error('Unable to check authentication configuration.');
  const data = await response.json();
  return Boolean(data.configured);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const credentials = storedCredentials();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (credentials) headers.set('Authorization', `Basic ${btoa(`${credentials.email}:${credentials.password}`)}`);
  const response = await fetch(`${API_ROOT}${path}`, { ...options, headers });
  if (response.status === 401) {
    signOut();
    window.dispatchEvent(new Event('servicepro:unauthorized'));
    throw new Error('Your session has ended. Sign in again.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || data.message || `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type Customer = {
  id: number; code: string; name: string; gstin: string | null; billingAddress: string | null;
  contactName: string | null; phone: string | null; email: string | null; active: boolean;
};
export type Branch = {
  id: number; customerId: number; customerName: string; code: string; name: string; address: string;
  city: string | null; state: string | null; postalCode: string | null; managerName: string | null;
  phone: string | null; email: string | null; active: boolean;
};
export type Asset = {
  id: number; branchId: number; branchName: string; customerName: string; code: string; name: string;
  category: string; serialNumber: string | null; manufacturer: string | null; model: string | null;
  installedOn: string | null; warrantyUntil: string | null; conditionStatus: string;
};
export type Technician = { id: number; employeeCode: string; name: string; email: string | null; phone: string | null; status: string };
export type ServiceRequest = {
  id: number; requestNumber: string; customerId: number; customerName: string; branchId: number;
  branchName: string; assetId: number | null; assetName: string | null; summary: string; description: string;
  priority: string; status: string; reportedBy: string | null; createdAt: string;
};
export type WorkOrder = {
  id: number; workOrderNumber: string; requestId: number; requestNumber: string; customerName: string;
  branchName: string; assetName: string | null; summary: string; description: string; priority: string;
  technicianId: number | null; technicianName: string | null; technicianEmail: string | null; status: string; billableClass: string | null;
  scheduledStart: string | null; completionApproved: boolean; workPerformed?: string | null; createdAt: string;
};
export type Amc = {
  id: number; contractNumber: string; customerId: number; customerName: string; branchId: number | null;
  branchName: string; startsOn: string; endsOn: string; status: string; monthlyService: boolean;
};
export type Cycle = {
  id: number; contractId: number; contractNumber: string; customerName: string; branchName: string;
  assetId: number; assetCode: string; assetName: string; serviceMonth: number; serviceYear: number;
  status: string; actualServiceDate: string | null; workOrderId: number | null; serviceReport: string | null;
};
export type DashboardData = {
  customers: number; branches: number; assets: number; activeAmcs: number; newRequests: number;
  inProgress: number; completedWorkOrders: number; upcomingMaintenance: number;
  recentWorkOrders: WorkOrder[]; upcomingCycles: Cycle[];
};
