export type Role = 'admin' | 'staff';

export function canEditInvoice(
  role: Role,
  uploadedBy: string,
  userId: string,
  reviewStatus: string,
): boolean {
  return role === 'admin' || (uploadedBy === userId && reviewStatus === 'pending_review');
}
