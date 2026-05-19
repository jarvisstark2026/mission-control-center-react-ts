import type { ButtonHTMLAttributes } from 'react';

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

export function ActionButton({ variant = 'secondary', className, type = 'button', children, ...rest }: ActionButtonProps) {
  return (
    <button type={type} className={["action-button", variantClassNames[variant], className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  );
}
