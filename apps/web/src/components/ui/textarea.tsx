import * as React from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-24 w-full resize-y rounded-xl border border-input bg-card/80 px-3 py-2.5 text-sm leading-6 shadow-xs ring-offset-background transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-muted-foreground/80 hover:border-foreground/20 focus-visible:border-primary/45 focus-visible:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);

Textarea.displayName = 'Textarea';

export { Textarea };
