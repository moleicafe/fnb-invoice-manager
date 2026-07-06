'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { canEditInvoice, type Role } from '../../../../lib/auth/permissions';
import { buttonStyles } from '../../../../components/ui/button';
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

  return (
    <div className="flex flex-wrap gap-2">
      {canEditInvoice(props.role, props.uploadedBy, props.userId, props.reviewStatus) && (
        <Link href={`/invoices/${props.id}/edit`} className={buttonStyles('outline', 'md')}>
          {t('common.edit')}
        </Link>
      )}
      {isAdmin && props.reviewStatus === 'pending_review' && (
        <button
          className={buttonStyles('primary', 'md')}
          disabled={pending}
          onClick={() => startTransition(() => approveInvoice(props.id))}
        >
          {t('detail.approve')}
        </button>
      )}
      {isAdmin && props.paymentStatus === 'unpaid' && (
        <button
          className={buttonStyles('outline', 'md')}
          disabled={pending}
          onClick={() => startTransition(() => markInvoicePaid(props.id))}
        >
          {t('detail.markPaid')}
        </button>
      )}
      {isAdmin && (
        <button
          className={buttonStyles('danger', 'md')}
          disabled={pending}
          onClick={() => {
            if (window.confirm(t('detail.deleteConfirm'))) {
              startTransition(() => deleteInvoice(props.id));
            }
          }}
        >
          {t('common.delete')}
        </button>
      )}
    </div>
  );
}
