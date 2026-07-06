import { describe, it, expect } from 'vitest';
import { canEditInvoice } from '../src/lib/auth/permissions';

describe('canEditInvoice', () => {
  it('admin can edit anything', () => {
    expect(canEditInvoice('admin', 'someone-else', 'me', 'approved')).toBe(true);
  });
  it('staff can edit their own pending invoice', () => {
    expect(canEditInvoice('staff', 'me', 'me', 'pending_review')).toBe(true);
  });
  it('staff cannot edit their own invoice after approval', () => {
    expect(canEditInvoice('staff', 'me', 'me', 'approved')).toBe(false);
  });
  it("staff cannot edit someone else's invoice", () => {
    expect(canEditInvoice('staff', 'someone-else', 'me', 'pending_review')).toBe(false);
  });
});
