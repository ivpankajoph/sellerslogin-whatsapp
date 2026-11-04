import { store } from "@/store";

export type WhatsAppUser = {
  id: string;
  username?: string;
  name?: string;
  email?: string;
  avatar?: string;
  role?: string;
  pageAccess?: string[];
};

export function whatsappUser(): WhatsAppUser | null {
  const user = store.getState().auth.user?.whatsapp;
  if (!user?.id) return null;
  return user as WhatsAppUser;
}

export function asList(value: unknown): Record<string, any>[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["data", "items", "results", "rows", "contacts", "templates", "campaigns", "flows", "logs", "users", "chats", "messages", "agents", "forms", "leads"]) {
      if (Array.isArray(record[key])) return record[key] as Record<string, any>[];
    }
  }
  return [];
}

export function rowId(row: Record<string, any> | null | undefined) {
  return String(row?.id || row?._id || "");
}

export function uniqueRows(rows: Record<string, any>[]) {
  const seen = new Set<string>();
  return rows.filter((row, index) => {
    const id = rowId(row) || String(row?.phone || row?.form_id || "");
    const key = id || `row-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function apiErrorMessage(payload: any, fallback: string) {
  return String(payload?.userMessage || payload?.message || payload?.error || fallback);
}

export async function wa<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const user = whatsappUser();
  const headers = new Headers(init.headers || {});
  if (user?.id) {
    if (!headers.has("x-user-id")) headers.set("x-user-id", String(user.id));
    if (!headers.has("x-user-role")) headers.set("x-user-role", String(user.role || "user"));
    if (!headers.has("x-user-name")) headers.set("x-user-name", String(user.name || ""));
    if (!headers.has("x-user")) headers.set("x-user", JSON.stringify(user));
  }
  const body = init.body;
  if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const base = String(process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const response = await fetch(`${base}/whatsapp-marketing${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, `Request failed (${response.status})`));
  }
  return payload as T;
}

export async function exchangeLaunchToken(ssoToken: string) {
  const base = String(process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const response = await fetch(`${base}/whatsapp-marketing/auth/sellerslaunch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: ssoToken }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success || !payload?.user) {
    throw new Error(apiErrorMessage(payload, "Unable to open the WhatsApp workspace"));
  }
  return payload.user as WhatsAppUser;
}
