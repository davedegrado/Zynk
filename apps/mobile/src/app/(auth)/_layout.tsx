import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../lib/session';

export default function AuthLayout() {
  const { status } = useSession();
  if (status === 'loading') return null;
  if (status === 'signedIn') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
