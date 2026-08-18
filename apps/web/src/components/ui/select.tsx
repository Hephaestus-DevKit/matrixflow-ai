import * as React from 'react';
import { cn } from '@/lib/cn';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-xl border border-input bg-card/80 px-3 text-sm shadow-xs ring-offset-background transition-[border-color,background-color,box-shadow] duration-200 hover:border-foreground/20 focus-visible:border-primary/45 focus-visible:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);

Select.displayName = 'Select';

export { Select };
