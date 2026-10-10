import { redirect } from 'next/navigation';

export default function NewContentProjectPage() {
  redirect('/dashboard/content?create=1');
}
