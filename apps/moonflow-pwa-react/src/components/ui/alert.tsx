import * as React from 'react';
import { cn } from 'cn';

function Alert({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        'flex items-center gap-flow-2 rounded-md bg-destructive/10 px-flow-3 py-flow-2 text-flow-caption text-destructive',
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('text-flow-caption', className)} {...props} />;
}

export { Alert, AlertDescription };
