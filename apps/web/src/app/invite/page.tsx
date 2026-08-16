import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { InviteClient } from './invite-client';

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
        </div>
      }
    >
      <InviteClient />
    </Suspense>
  );
}
