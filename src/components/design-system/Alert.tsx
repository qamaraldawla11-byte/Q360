import { forwardRef, type HTMLAttributes } from 'react';
import './index.css';

export type AlertVariant = 'error' | 'success' | 'info' | 'warning';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', className = '', children, role, ...rest }, ref) => {
    const combinedClass = ['q-alert', `q-alert--${variant}`, className]
      .filter(Boolean)
      .join(' ');

    const defaultRole = variant === 'error' ? 'alert' : 'status';

    return (
      <div
        ref={ref}
        className={combinedClass}
        role={role ?? defaultRole}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Alert.displayName = 'Alert';
