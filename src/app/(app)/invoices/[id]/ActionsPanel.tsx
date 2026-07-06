'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { canEditInvoice, type Role } from '../../../../lib/auth/permissions';
import { buttonVariants } from '../../../../components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from '../../../../components/ui/alert-dialog';
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isAdmin = props.role === 'admin';

  return (
    <div className="flex flex-wrap gap-2">
      {canEditInvoice(props.role, props.uploadedBy, props.userId, props.reviewStatus) && (
        <Link href={`/invoices/${props.id}/edit`} className={buttonVariants({ variant: 'outline' })}>
          {t('common.edit')}
        </Link>
      )}
      {isAdmin && props.reviewStatus === 'pending_review' && (
        <button
          className={buttonVariants()}
          disabled={pending}
          onClick={() => startTransition(() => approveInvoice(props.id))}
        >
          {t('detail.approve')}
        </button>
      )}
      {isAdmin && props.paymentStatus === 'unpaid' && (
        <button
          className={buttonVariants({ variant: 'outline' })}
          disabled={pending}
          onClick={() => startTransition(() => markInvoicePaid(props.id))}
        >
          {t('detail.markPaid')}
        </button>
      )}
      {isAdmin && (
        <>
          <button
            className={buttonVariants({ variant: 'destructive' })}
            disabled={pending}
            onClick={() => setDeleteOpen(true)}
          >
            {t('common.delete')}
          </button>
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogDescription>{t('detail.deleteConfirm')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: 'destructive' })}
                  onClick={() => startTransition(() => deleteInvoice(props.id))}
                >
                  {t('common.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
