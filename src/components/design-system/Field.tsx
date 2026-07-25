import { cloneElement, isValidElement, type ReactElement } from 'react';
import './index.css';

export interface FieldProps {
  label: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string }>;
  hint?: string;
  error?: string;
}

export const Field = ({ label, children, hint, error }: FieldProps) => {
  if (!isValidElement(children)) {
    throw new Error('Field children must be a valid React element');
  }

  const childId = children.props.id;
  if (!childId) {
    throw new Error('Field child must have an id prop');
  }

  const errorId = error ? `${childId}-error` : undefined;
  const hintId = hint ? `${childId}-hint` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const childWithA11y = describedBy
    ? cloneElement(children, { 'aria-describedby': describedBy })
    : children;

  return (
    <div className="q-field">
      <label htmlFor={childId} className="q-field__label">
        {label}
      </label>
      {childWithA11y}
      {hint && !error && (
        <p id={hintId} className="q-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="q-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
