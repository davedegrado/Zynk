import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../../i18n';
import { radius, space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

interface ConfirmOptions {
  title: string;
  body?: string;
  confirm?: string;
  cancel?: string;
  destructive?: boolean;
}

const DialogContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

/** Promise-based, on-brand confirm dialog: `if (await confirm({...})) ...` */
export function DialogProvider({ children }: { children: ReactNode }) {
  const t = useAppTheme();
  const { t: tr } = useI18n();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <DialogContext.Provider value={confirm}>
      {children}
      <Modal visible={!!opts} transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => close(false)} accessibilityLabel="Dismiss">
          <Pressable style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]} accessibilityViewIsModal>
            <Text variant="heading">{opts?.title}</Text>
            {opts?.body ? <Text tone="muted">{opts.body}</Text> : null}
            <View style={styles.actions}>
              <Button title={opts?.cancel ?? tr('common.cancel')} variant="ghost" size="sm" onPress={() => close(false)} />
              <Button title={opts?.confirm ?? tr('common.ok')} variant={opts?.destructive ? 'danger' : 'primary'} size="sm" onPress={() => close(true)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}

export const useConfirm = () => useContext(DialogContext);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,5,10,0.7)', justifyContent: 'center', padding: space.xl },
  card: { borderRadius: radius.xl, borderWidth: 1, padding: space.xl, gap: space.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
});
