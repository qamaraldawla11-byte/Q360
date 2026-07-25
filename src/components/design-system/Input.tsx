import { forwardRef, type InputHTMLAttributes } from 'react';
import './index.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  isInvalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ isInvalid = false, className = '', ...rest }, ref) => {
    const combinedClass = ['q-input', className].filter(Boolean).join(' ');

    return (
      <input
        ref={ref}
        className={combinedClass}
        aria-invalid={isInvalid}
        {...rest}
      />
    );
  }
);

Input.displayName = 'Input';
