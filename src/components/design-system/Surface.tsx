import { forwardRef, type HTMLAttributes } from 'react';
import './index.css';

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className = '', children, ...rest }, ref) => {
    const combinedClass = ['q-surface', className].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={combinedClass} {...rest}>
        {children}
      </div>
    );
  }
);

Surface.displayName = 'Surface';
