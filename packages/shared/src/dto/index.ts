// @matrixflow/shared · DTO
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}
export interface OrgContext {
  organizationId: string;
  role: string;
  permissions: string[];
}
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
