import { forwardRef, type HTMLAttributes } from 'react';
import './index.css';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', className = '', children, ...rest }, ref) => {
    const combinedClass = ['q-badge', `q-badge--${variant}`, className]
      .filter(Boolean)
      .join(' ');

    return (
      <span ref={ref} className={combinedClass} {...rest}>
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
