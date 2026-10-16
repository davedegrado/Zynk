import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CountBadge, Icon, Text, type IconName } from '../../../components/ui';
import { useI18n, type MessageKey } from '../../../i18n';
import { haptic } from '../../../lib/haptics';
import { useActivity, useFriendRequests } from '../../../lib/hooks';
import { radius, space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

const TABS: Record<string, { label: MessageKey; icon: IconName }> = {
  index: { label: 'tabs.friends', icon: 'friends' },
  activity: { label: 'tabs.activity', icon: 'activity' },
  add: { label: 'tabs.add', icon: 'add' },
  profile: { label: 'tabs.profile', icon: 'profile' },
};

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const t = useAppTheme();
  const { t: tr } = useI18n();
  const insets = useSafeAreaInsets();
  const unseen = useActivity('all').data?.unseenCount ?? 0;
  const requests = useFriendRequests().data?.incoming.length ?? 0;
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.md) }]} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const focused = state.index === i;
          const count = route.name === 'activity' ? unseen : route.name === 'add' ? requests : 0;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={count ? tr('tabs.newCount', { label: tr(meta.label), count }) : tr(meta.label)}
              onPress={() => {
                if (!focused) {
                  void haptic.tap();
                  navigateToTab(route.key);
                }
              }}
              style={[styles.item, focused && { backgroundColor: t.colors.accent }, focused && t.scheme === 'light' && { borderWidth: 2, borderColor: t.colors.text }]}
            >
              <Icon name={meta.icon} size={22} color={focused ? t.colors.onAccent : t.colors.textMuted} />
              {focused ? <Text variant="label" style={{ color: t.colors.onAccent, fontSize: 11 }}>{tr(meta.label)}</Text> : null}
              {count > 0 && !focused ? (
                <View style={styles.badge}>
                  <CountBadge count={count} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg },
  bar: { flexDirection: 'row', borderRadius: radius.pill, borderWidth: 1, padding: space.xs, gap: space.xs },
  item: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, height: 52, borderRadius: radius.pill },
  badge: { position: 'absolute', top: 2, right: 10 },
});
