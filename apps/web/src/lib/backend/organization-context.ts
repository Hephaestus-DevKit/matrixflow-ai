const STORAGE_KEY = 'matrixflow-organization-id';
let selectedOrganizationId: string | null = null;

export function setOrganizationContext(organizationId: string | null) {
  selectedOrganizationId = organizationId;
  if (typeof window === 'undefined') return;
  if (organizationId) sessionStorage.setItem(STORAGE_KEY, organizationId);
  else sessionStorage.removeItem(STORAGE_KEY);
}

export function getOrganizationContext(): string {
  const organizationId =
    selectedOrganizationId ??
    (typeof window === 'undefined' ? null : sessionStorage.getItem(STORAGE_KEY));
  if (!organizationId) throw new Error('团队空间尚未就绪，请重新登录');
  selectedOrganizationId = organizationId;
  return organizationId;
}

export function clearOrganizationContext() {
  setOrganizationContext(null);
  if (typeof window !== 'undefined') localStorage.removeItem('mfa-auth');
}
