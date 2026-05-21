import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { classNames } from '../../lib/classNames';
import '../../styles/components.css';

type ActionButtonVariant = 'primary' | 'secondary' | 'ghost';

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionButtonVariant;
};

const variantClassNames: Record<ActionButtonVariant, string> = {
  primary: 'action-button--primary',
  secondary: 'action-button--secondary',
  ghost: 'action-button--ghost',
};

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { variant = 'secondary', className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={classNames('action-button', variantClassNames[variant], className)} {...rest}>
      {children}
    </button>
  );
});
