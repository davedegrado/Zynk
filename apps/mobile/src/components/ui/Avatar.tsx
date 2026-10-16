import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { AVATAR_ART, BRAND, getBubbleColor, isAvatarId, type AvatarRole, type AvatarShape, type PublicUser } from '@zynk/shared';

const ROLE_COLORS: Record<Exclude<AvatarRole, 'bg'>, string> = {
  body: BRAND.colors.white,
  ink: BRAND.colors.ink,
  blush: BRAND.colors.pink,
};

function Shape({ shape, bg }: { shape: AvatarShape; bg: string }) {
  const color = (role: AvatarRole | 'none' | undefined) =>
    role === undefined || role === 'none' ? 'none' : role === 'bg' ? bg : ROLE_COLORS[role];
  const props = { ...shape.attrs, fill: color(shape.fill), stroke: shape.stroke ? color(shape.stroke) : undefined } as Record<string, unknown>;
  switch (shape.kind) {
    case 'circle':
      return <Circle {...props} />;
    case 'ellipse':
      return <Ellipse {...props} />;
    case 'rect':
      return <Rect {...props} />;
    default:
      return <Path {...(props as { d: string })} />;
  }
}

/** Renders a drawn avatar character (no photos) on its chosen background color. */
export function AvatarArt({ avatarId, colorId, size = 48 }: { avatarId: string; colorId: string; size?: number }) {
  const clipId = `av${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const bg = (getBubbleColor(colorId) ?? getBubbleColor('lime')!).color;
  const art = AVATAR_ART[isAvatarId(avatarId) ? avatarId : 'cat'];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={50} cy={50} r={50} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Circle cx={50} cy={50} r={50} fill={bg} />
        {art.map((s, i) => (
          <Shape key={i} shape={s} bg={bg} />
        ))}
      </G>
    </Svg>
  );
}

export function Avatar({ user, size = 48, ring }: { user: Pick<PublicUser, 'displayName' | 'avatar'>; size?: number; ring?: string }) {
  return (
    <View
      accessibilityLabel={`${user.displayName}`}
      style={[
        { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' },
        ring && { borderWidth: 3, borderColor: ring, padding: 0 },
      ]}
    >
      <AvatarArt avatarId={user.avatar.id} colorId={user.avatar.color} size={ring ? size - 6 : size} />
    </View>
  );
}
