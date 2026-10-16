import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SOUNDS, type PushData } from '@zynk/shared';
import { api } from './api';
import { EAS_PROJECT_ID } from './config';
import { incomingZynks } from './events';
import { keys, queryClient } from './query';
import { onSignOut, useSession } from './session';

// Foreground behaviour: Zynks are shown with our own in-app animation and sound
// (respecting the user's settings), so the system banner/sound is suppressed.
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const data = n.request.content.data as Partial<PushData> | undefined;
    const isZynk = data?.type === 'zynk';
    return {
      shouldShowBanner: !isZynk,
      shouldShowList: true,
      shouldPlaySound: !isZynk,
      shouldSetBadge: true,
    };
  },
});

/**
 * Android binds sound to a notification channel (Android 8+), so each catalog
 * sound gets its own channel. Users can further tune every channel in system settings.
 */
export async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    ...SOUNDS.map((s) =>
      Notifications.setNotificationChannelAsync(s.id, {
        name: `Zynks · ${s.name}`,
        description: `Zynks that use the ${s.name} sound`,
        importance: AndroidImportance.HIGH,
        sound: `${s.file}.wav`,
        vibrationPattern: [0, 120, 60, 120],
        lightColor: '#DFFF00',
      }),
    ),
    Notifications.setNotificationChannelAsync('zynk_silent', {
      name: 'Zynks · Silent',
      description: 'Zynks when you have turned Zynk sounds off',
      importance: AndroidImportance.HIGH,
      sound: null,
      vibrationPattern: [0, 120, 60, 120],
    }),
    Notifications.setNotificationChannelAsync('social', {
      name: 'Friend requests',
      importance: AndroidImportance.DEFAULT,
    }),
  ]);
}

let registeredToken: string | null = null;

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export async function getPushPermission(): Promise<PushPermission> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

/** Registers this device's Expo push token with the backend. Never prompts. */
export async function registerDeviceIfPermitted(): Promise<boolean> {
  if ((await getPushPermission()) !== 'granted') return false;
  await ensureAndroidChannels();
  try {
    const { data } = await Notifications.getExpoPushTokenAsync(EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined);
    if (data && data !== registeredToken) {
      await api.registerDevice({ token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
      registeredToken = data;
    }
    return true;
  } catch {
    // Simulators, Expo Go without a project id, or missing FCM config: in-app delivery still works.
    return false;
  }
}

/** Asks for permission (only call from an explicit user action) and registers. */
export async function requestPushPermission(): Promise<PushPermission> {
  await ensureAndroidChannels();
  const res = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  if (res.granted) await registerDeviceIfPermitted();
  return getPushPermission();
}

onSignOut(async () => {
  if (registeredToken) {
    await api.unregisterDevice(registeredToken).catch(() => undefined);
    registeredToken = null;
  }
  await Notifications.setBadgeCountAsync(0).catch(() => undefined);
});

function urlToPath(url: string | undefined): string | null {
  if (!url?.startsWith('zynk://')) return null;
  const path = `/${url.slice('zynk://'.length)}`;
  return /^\/(activity|add|user\/[0-9a-f-]{36}|invite\/[A-Za-z0-9]+)(\?[\w=&-]*)?$/.test(path) ? path : null;
}

function openFromNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as Partial<PushData> | undefined;
  const path = urlToPath(data?.url);
  if (path) router.push(path as never);
}

/** Wires push token registration, deep-link routing and foreground handling. */
export function useNotifications() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'signedIn') return;
    void registerDeviceIfPermitted();

    const responseSub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      openFromNotification(last);
      void Notifications.clearLastNotificationResponseAsync();
    }

    const receivedSub = Notifications.addNotificationReceivedListener(async (n) => {
      const data = n.request.content.data as (Partial<PushData> & { soundId?: string | null }) | undefined;
      if (data?.type === 'zynk' && data.zynkId) {
        void queryClient.invalidateQueries({ queryKey: keys.activityAll });
        void queryClient.invalidateQueries({ queryKey: keys.friends });
        try {
          const zynk = await api.zynk(data.zynkId);
          incomingZynks.emit({ zynk, soundId: data.soundId ?? null });
        } catch {
          // The activity poll will pick it up.
        }
      } else if (data?.type === 'friend_request' || data?.type === 'friend_accepted') {
        void queryClient.invalidateQueries({ queryKey: keys.requests });
        void queryClient.invalidateQueries({ queryKey: keys.friends });
      }
    });
    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, [status]);
}
