import { AuthShell } from '@/components/auth-shell';
import { redirectIfSignedIn } from '@/server/auth/session.service';

export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  await redirectIfSignedIn('/');
  return <AuthShell mode="sign-in" />;
}
