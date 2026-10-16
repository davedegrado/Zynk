import { useQuery } from '@tanstack/react-query';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { FEATURE_IDS, FEATURE_INFO, type FeatureId } from '@zynk/shared';
import { Button, Card, Icon, Loading, PlusBadge, Screen, Text, useToast, type IconName } from '../../components/ui';
import { ReactionGlyph } from '../../components/zynk/ReactionGlyph';
import { useI18n } from '../../i18n';
import { LEGAL_URLS } from '../../lib/config';
import { formatDate, periodLabel } from '../../lib/format';
import { useEntitlements, useIsPlus, usePlans } from '../../lib/hooks';
import { loadStorePlans, openManageSubscription, purchasePlan, purchasesAvailableOnDevice, restorePurchases, type PurchaseOutcome, type StorePlan } from '../../lib/purchases';
import { useSession } from '../../lib/session';
import { radius, space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';

const FEATURE_ICON: Record<FeatureId, IconName> = {
  custom_sounds: 'sound',
  premium_emoji_packs: 'sparkle',
  custom_themes: 'palette',
  exclusive_effects: 'star',
};

export default function PlusScreen() {
  const t = useAppTheme();
  const { t: tr, td } = useI18n();
  const toast = useToast();
  const { user } = useSession();
  const isPlus = useIsPlus();
  const entitlements = useEntitlements();
  const plans = usePlans();
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const deviceOk = purchasesAvailableOnDevice();
  const storePlans = useQuery({
    queryKey: ['store-plans', plans.data?.plans, user?.id],
    queryFn: () => loadStorePlans(plans.data!.plans),
    enabled: !!plans.data,
  });
  const sub = entitlements.data?.subscription;
  const grant = entitlements.data?.entitlements[0];
  const canBuy = !!plans.data?.purchasesEnabled && deviceOk;

  const handle = (o: PurchaseOutcome) => {
    switch (o.kind) {
      case 'success':
        setPending(false);
        toast(tr('plus.welcome'), 'success');
        break;
      case 'verifying':
        setPending(true);
        toast(tr('plus.verifying'), 'info');
        break;
      case 'pending':
        setPending(true);
        toast(tr('plus.pending'), 'info');
        break;
      case 'error':
        toast(o.message, 'error');
        break;
      case 'cancelled':
        break;
    }
  };

  const buy = async (plan: StorePlan) => {
    setBusy(plan.id);
    try {
      handle(await purchasePlan(plan));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen back title="Speow Plus" subtitle={tr('plus.subtitle')}>
      <View style={styles.features}>
        {FEATURE_IDS.map((f) => (
          <Card key={f} style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: t.colors.accent }]}>
              <Icon name={FEATURE_ICON[f]} color={t.colors.onAccent} />
            </View>
            <Text variant="bodyStrong">{td(`feature.${f}.title`, FEATURE_INFO[f].title)}</Text>
            <Text variant="caption" tone="muted">{td(`feature.${f}.desc`, FEATURE_INFO[f].description)}</Text>
          </Card>
        ))}
      </View>
      <View style={styles.preview} accessibilityLabel={tr('plus.previewA11y')}>
        {['y2k:sparkle', 'y2k:alien', 'y2k:butterfly', 'moves:hop_frog', 'y2k:pixel_heart'].map((r) => (
          <ReactionGlyph key={r} reactionId={r} size={44} />
        ))}
      </View>

      {isPlus ? (
        <Card style={{ gap: space.sm, borderColor: t.colors.accent, borderWidth: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text variant="heading">{tr('plus.youHave')}</Text>
            <PlusBadge />
          </View>
          {sub ? (
            <>
              <Text>{td(`plus.status.${sub.status}`, sub.status)}</Text>
              {sub.expiresAt ? <Text tone="muted">{tr(sub.willRenew ? 'plus.renews' : 'plus.ends', { date: formatDate(sub.expiresAt) })}</Text> : null}
              {sub.isSandbox ? <Text variant="caption" tone="muted">{tr('plus.sandbox')}</Text> : null}
              <Button title={tr('plus.manage', { store: Platform.OS === 'ios' ? 'App Store' : 'Google Play' })} variant="secondary" size="sm" onPress={() => void openManageSubscription(sub.managementUrl, sub.productId)} />
            </>
          ) : grant ? (
            <Text tone="muted">{tr(grant.source === 'store' ? 'plus.storeSub' : 'plus.complimentary')}{grant.expiresAt ? ` ${tr('plus.until', { date: formatDate(grant.expiresAt) })}` : ''}.</Text>
          ) : null}
        </Card>
      ) : (
        <View style={{ gap: space.md }}>
          {plans.data?.promoMessage ? <Text variant="bodyStrong" tone="accent" center>{plans.data.promoMessage}</Text> : null}
          {plans.isLoading || storePlans.isLoading ? (
            <Loading size={36} />
          ) : (
            (storePlans.data ?? []).map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canBuy || !p.pkg }}
                disabled={!canBuy || !p.pkg || busy !== null}
                onPress={() => void buy(p)}
                style={[styles.plan, { backgroundColor: t.colors.surface, borderColor: p.badge ? t.colors.accent : t.colors.border, opacity: canBuy && p.pkg ? 1 : 0.6 }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text variant="heading">{tr(p.period === 'P1M' ? 'plus.monthly' : 'plus.annual')}</Text>
                    {p.badge ? <View style={[styles.badge, { backgroundColor: t.colors.accent }]}><Text variant="label" style={{ color: t.colors.onAccent, fontSize: 10 }}>{p.badge === 'Best value' ? tr('plus.bestValue') : p.badge}</Text></View> : null}
                  </View>
                  <Text tone="muted">
                    {(p.priceString ?? p.fallbackPrice.display) + ' / ' + periodLabel(p.period)}
                    {!p.priceString ? ` ${tr('plus.indicative')}` : ''}
                  </Text>
                  {p.introOffer ? <Text variant="caption" tone="accent">{p.introOffer}</Text> : null}
                </View>
                {busy === p.id ? <Loading size={28} /> : <Icon name="chevron" color={t.colors.textMuted} />}
              </Pressable>
            ))
          )}
          {!canBuy ? (
            <Text variant="caption" tone="muted" center>
              {!plans.data?.purchasesEnabled
                ? tr('plus.unavailable')
                : tr('plus.needStore')}
            </Text>
          ) : null}
          {pending ? <Text variant="caption" tone="muted" center>{tr('plus.waiting')}</Text> : null}
        </View>
      )}

      <Button
        title={tr('plus.restore')}
        variant="ghost"
        loading={busy === 'restore'}
        disabled={!plans.data?.purchasesEnabled}
        onPress={async () => {
          setBusy('restore');
          try {
            handle(await restorePurchases());
          } finally {
            setBusy(null);
          }
        }}
      />
      <Text variant="caption" tone="muted" center>
        {tr('plus.legal', { store: Platform.OS === 'ios' ? 'App Store' : 'Google Play' })}
      </Text>
      {LEGAL_URLS.terms || LEGAL_URLS.privacy ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg }}>
          {LEGAL_URLS.terms ? <Button title={tr('plus.terms')} variant="ghost" size="sm" onPress={() => void openBrowserAsync(LEGAL_URLS.terms)} /> : null}
          {LEGAL_URLS.privacy ? <Button title={tr('plus.privacy')} variant="ghost" size="sm" onPress={() => void openBrowserAsync(LEGAL_URLS.privacy)} /> : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  feature: { width: '48.5%', gap: space.xs, padding: space.md },
  featureIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  preview: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
  plan: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
});
