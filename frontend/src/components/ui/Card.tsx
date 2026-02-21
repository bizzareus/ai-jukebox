import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export function Card({ glow, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`
        bg-surface-card rounded-2xl border border-surface-border shadow-sm
        ${glow ? 'shadow-md shadow-brand-600/10 border-brand-200' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
