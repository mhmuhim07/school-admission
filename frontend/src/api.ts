import { API_URL } from "./config";
import type { CreateClassPayload, Hold, SchoolClass } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  studentId?: string
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (studentId) {
    headers.set("X-Student-Id", studentId.trim());
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      "Cannot connect to the server. Please ensure the backend is running and try again.",
      0,
      "NETWORK_ERROR"
    );
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const errorObj = (body as { error?: { code?: string; message?: string } })?.error;
    const message =
      errorObj?.message ||
      `Request failed with status ${res.status} (${res.statusText || "Error"})`;
    throw new ApiError(message, res.status, errorObj?.code);
  }

  return body as T;
}

export const api = {
  // 1. POST /classes
  createClass(payload: CreateClassPayload): Promise<SchoolClass> {
    return request<SchoolClass>("/classes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // 2. GET /classes
  getClasses(): Promise<SchoolClass[]> {
    return request<SchoolClass[]>("/classes");
  },

  // 3. GET /classes/{classId}
  getClass(classId: string): Promise<SchoolClass> {
    return request<SchoolClass>(`/classes/${encodeURIComponent(classId)}`);
  },

  // 4. POST /classes/{classId}/holds
  createHold(classId: string, studentId: string): Promise<Hold> {
    return request<Hold>(
      `/classes/${encodeURIComponent(classId)}/holds`,
      { method: "POST" },
      studentId
    );
  },

  // 5. GET /holds/{holdId}
  getHold(holdId: string): Promise<Hold> {
    return request<Hold>(`/holds/${encodeURIComponent(holdId)}`);
  },

  // 6. POST /holds/{holdId}/confirm
  confirmHold(
    holdId: string,
    studentId: string
  ): Promise<{ holdId: string; status: string }> {
    return request<{ holdId: string; status: string }>(
      `/holds/${encodeURIComponent(holdId)}/confirm`,
      { method: "POST" },
      studentId
    );
  },

  // 7. DELETE /holds/{holdId}
  cancelHold(holdId: string, studentId: string): Promise<void> {
    return request<void>(
      `/holds/${encodeURIComponent(holdId)}`,
      { method: "DELETE" },
      studentId
    );
  },

  // 8. GET /me/holds
  getMyHolds(studentId: string): Promise<Hold[]> {
    return request<Hold[]>("/me/holds", { method: "GET" }, studentId);
  },
};

