import * as Haptics from 'expo-haptics';

export const haptic = {
  zynk: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined),
  tap: () => Haptics.selectionAsync().catch(() => undefined),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined),
};
