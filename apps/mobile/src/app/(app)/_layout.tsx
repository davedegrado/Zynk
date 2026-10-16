import { Redirect, router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { IncomingZynkOverlay } from '../../components/zynk/IncomingZynkOverlay';
import { Loading } from '../../components/ui';
import { useNotifications } from '../../lib/notifications';
import { pendingInvite } from '../../lib/pending-invite';
import { configurePurchases } from '../../lib/purchases';
import { useSession } from '../../lib/session';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function AppLayout() {
  const t = useAppTheme();
  const { status, user } = useSession();
  useNotifications();

  useEffect(() => {
    if (status !== 'signedIn') return;
    if (user) void configurePurchases(user.id);
    const code = pendingInvite.take();
    if (code) setTimeout(() => router.push(`/invite/${code}`), 0);
  }, [status, user]);

  if (status === 'loading') return <Loading />;
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="report/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plus" options={{ presentation: 'modal' }} />
      </Stack>
      <IncomingZynkOverlay />
    </>
  );
}
