import { Pressable, StyleSheet, View } from 'react-native';
import { Divider, Icon, Screen, Section, Text } from '../../../components/ui';
import { deviceLanguage, LANGUAGE_NAMES, useI18n, type LanguageChoice } from '../../../i18n';
import { space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

export default function LanguageSettings() {
  const theme = useAppTheme();
  const { t, choice, setChoice } = useI18n();
  const options: { id: LanguageChoice; label: string }[] = [
    { id: 'system', label: t('language.system', { lang: LANGUAGE_NAMES[deviceLanguage()] }) },
    { id: 'it', label: LANGUAGE_NAMES.it },
    { id: 'en', label: LANGUAGE_NAMES.en },
  ];
  return (
    <Screen back title={t('language.title')} subtitle={t('language.subtitle')}>
      <Section>
        {options.map((o, i) => (
          <View key={o.id}>
            {i > 0 ? <Divider /> : null}
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: choice === o.id }} onPress={() => void setChoice(o.id)} style={styles.row}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>{o.label}</Text>
              {choice === o.id ? <Icon name="check" color={theme.colors.accentText} /> : null}
            </Pressable>
          </View>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
});
