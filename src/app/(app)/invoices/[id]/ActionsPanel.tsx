'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { canEditInvoice, type Role } from '../../../../lib/auth/permissions';
import { approveInvoice, deleteInvoice, markInvoicePaid } from './actions';

export function Actions(props: {
  id: string;
  role: Role;
  userId: string;
  uploadedBy: string;
  reviewStatus: string;
  paymentStatus: string;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const isAdmin = props.role === 'admin';
  const btn = 'rounded border px-2 py-1 text-sm disabled:opacity-50';

  return (
    <div className="flex flex-wrap gap-2">
      {canEditInvoice(props.role, props.uploadedBy, props.userId, props.reviewStatus) && (
        <Link href={`/invoices/${props.id}/edit`} className={btn}>{t('common.edit')}</Link>
      )}
      {isAdmin && props.reviewStatus === 'pending_review' && (
        <button className={`${btn} bg-green-600 text-white`} disabled={pending}
          onClick={() => startTransition(() => approveInvoice(props.id))}>
          {t('detail.approve')}
        </button>
      )}
      {isAdmin && props.paymentStatus === 'unpaid' && (
        <button className={btn} disabled={pending}
          onClick={() => startTransition(() => markInvoicePaid(props.id))}>
          {t('detail.markPaid')}
        </button>
      )}
      {isAdmin && (
        <button className={`${btn} text-red-600`} disabled={pending}
          onClick={() => {
            if (window.confirm(t('detail.deleteConfirm'))) {
              startTransition(() => deleteInvoice(props.id));
            }
          }}>
          {t('common.delete')}
        </button>
      )}
    </div>
  );
}
