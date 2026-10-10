const STORAGE_KEY = 'matrixflow-organization-id';
// undefined means not initialized; null explicitly clears a previous workspace.
let selectedOrganizationId: string | null | undefined;

export function setOrganizationContext(organizationId: string | null) {
  selectedOrganizationId = organizationId;
  if (typeof window === 'undefined') return;
  try {
    if (organizationId) sessionStorage.setItem(STORAGE_KEY, organizationId);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Restricted storage must not prevent a verified session from working.
  }
}

export function getOrganizationContext(): string {
  if (selectedOrganizationId === undefined) {
    try {
      selectedOrganizationId =
        typeof window === 'undefined' ? null : sessionStorage.getItem(STORAGE_KEY);
    } catch {
      selectedOrganizationId = null;
    }
  }
  if (!selectedOrganizationId) throw new Error('团队空间尚未就绪，请重新登录');
  return selectedOrganizationId;
}

export function clearOrganizationContext() {
  setOrganizationContext(null);
}
