export type HoldStatus = "HELD" | "CONFIRMED" | "EXPIRED" | "CANCELLED";

export interface SchoolClass {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface CreateClassPayload {
  name: string;
  totalSeats: number;
}

export interface Hold {
  holdId: string;
  classId: string;
  className?: string;
  studentId?: string;
  status: HoldStatus;
  expiresAt: string;
  serverTime?: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  error?: ApiErrorDetail;
}

