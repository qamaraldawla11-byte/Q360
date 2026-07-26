import { forwardRef, type HTMLAttributes } from 'react';
import './index.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', children, ...rest }, ref) => {
    const combinedClass = ['q-card', className].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={combinedClass} {...rest}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
