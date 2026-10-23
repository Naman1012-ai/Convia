import React from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AlertTriangle } from 'lucide-react';

export function ConfirmDialog({
  isOpen = false,
  onConfirm,
  onCancel,
  onClose,
  title = 'Confirm Action',
  description,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant = 'danger',
  isLoading = false,
  disabled = false,
}) {
  const handleCancel = onCancel || onClose || (() => {});
  const effectiveDescription = description || message || 'Are you sure you want to proceed?';
  const effectiveConfirmLabel = confirmLabel || confirmText || 'Confirm';
  const effectiveCancelLabel = cancelLabel || cancelText || 'Cancel';
  const isDisabled = disabled || isLoading;

  const iconStyles = {
    danger: 'bg-rose-50 text-rose-600',
    warning: 'bg-amber-50 text-amber-600',
    primary: 'bg-primary-50 text-primary-600',
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title={title} size="sm">
      <div className="flex flex-col items-center text-center py-2">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${iconStyles[variant] || iconStyles.danger}`}>
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-sm text-slate-600 mb-6">{effectiveDescription}</p>
        <div className="flex w-full justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="ghost" onClick={handleCancel} disabled={isDisabled}>
            {effectiveCancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading} disabled={isDisabled}>
            {effectiveConfirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

ConfirmDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  onClose: PropTypes.func,
  title: PropTypes.string,
  description: PropTypes.string,
  message: PropTypes.string,
  confirmLabel: PropTypes.string,
  confirmText: PropTypes.string,
  cancelLabel: PropTypes.string,
  cancelText: PropTypes.string,
  variant: PropTypes.string,
  isLoading: PropTypes.bool,
  disabled: PropTypes.bool,
};
