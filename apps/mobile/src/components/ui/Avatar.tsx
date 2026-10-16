import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { BRAND, type PublicUser } from '@zynk/shared';
import { absoluteUrl, authHeaders } from '../../lib/api';
import { fonts } from '../../theme/tokens';
import { Text } from './Text';

const SWATCHES = [BRAND.colors.lime, BRAND.colors.purple, BRAND.colors.electricBlue, BRAND.colors.pink, BRAND.colors.white];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ user, size = 48, ring }: { user: Pick<PublicUser, 'id' | 'displayName' | 'avatarUrl'>; size?: number; ring?: string }) {
  const bg = SWATCHES[hash(user.id) % SWATCHES.length]!;
  const initials = user.displayName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <View
      accessibilityLabel={`${user.displayName}'s avatar`}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        ring && { borderWidth: 3, borderColor: ring },
      ]}
    >
      {user.avatarUrl ? (
        <Image
          source={{ uri: absoluteUrl(user.avatarUrl), headers: authHeaders() }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : (
        <Text style={{ fontFamily: fonts.display, fontSize: size * 0.36, color: BRAND.colors.ink, lineHeight: size * 0.44 }}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
