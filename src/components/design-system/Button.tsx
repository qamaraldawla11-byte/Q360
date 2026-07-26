import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './index.css';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      isLoading = false,
      fullWidth = false,
      children,
      disabled,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const classNames = [
      'q-btn',
      `q-btn--${variant}`,
      fullWidth ? 'q-btn--full' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={classNames}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...rest}
      >
        {isLoading && <span className="q-btn__spinner" aria-hidden="true" />}
        <span className="q-btn__label">{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';
