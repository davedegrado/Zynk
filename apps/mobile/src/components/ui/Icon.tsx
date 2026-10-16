import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useAppTheme } from '../../theme/ThemeProvider';

export type IconName =
  | 'friends' | 'activity' | 'add' | 'profile' | 'bolt' | 'back' | 'close' | 'check' | 'lock' | 'search'
  | 'share' | 'sound' | 'soundOff' | 'more' | 'chevron' | 'star' | 'palette' | 'shield' | 'flag' | 'trash'
  | 'camera' | 'sparkle' | 'arrowIn' | 'arrowOut' | 'link';

/** Custom 24px stroke icon set (2px strokes, round caps) — no generic bells. */
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: string }) {
  const t = useAppTheme();
  const c = color ?? t.colors.text;
  const p = { stroke: c, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const body = (() => {
    switch (name) {
      case 'friends':
        return (<><Circle cx={9} cy={8} r={3.5} {...p} /><Path d="M2.5 19c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2" {...p} /><Path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 13.9c1.9.7 3.1 2.4 3.5 5.1" {...p} /></>);
      case 'activity':
        return <Path d="M3 12h4l2.5-6 5 12 2.5-6h4" {...p} />;
      case 'add':
        return (<><Circle cx={10} cy={8} r={3.5} {...p} /><Path d="M3.5 19c.8-3.4 3.4-5.2 6.5-5.2 1.2 0 2.3.3 3.3.8M18.5 13v7M15 16.5h7" {...p} /></>);
      case 'profile':
        return (<><Circle cx={12} cy={8} r={4} {...p} /><Path d="M4 20.5c1-4 4.2-6 8-6s7 2 8 6" {...p} /></>);
      case 'bolt':
        return <Path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12z" {...p} />;
      case 'back':
        return <Path d="M15 5l-7 7 7 7" {...p} />;
      case 'chevron':
        return <Path d="M9 5l7 7-7 7" {...p} />;
      case 'close':
        return <Path d="M6 6l12 12M18 6 6 18" {...p} />;
      case 'check':
        return <Path d="M4.5 12.5l5 5 10-11" {...p} />;
      case 'lock':
        return (<><Rect x={5} y={10.5} width={14} height={10} rx={3} {...p} /><Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...p} /></>);
      case 'search':
        return (<><Circle cx={11} cy={11} r={6.5} {...p} /><Path d="M16 16l4.5 4.5" {...p} /></>);
      case 'share':
        return <Path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" {...p} />;
      case 'link':
        return <Path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" {...p} />;
      case 'sound':
        return <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" {...p} />;
      case 'soundOff':
        return <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5" {...p} />;
      case 'more':
        return (<><Circle cx={5} cy={12} r={1.4} fill={c} /><Circle cx={12} cy={12} r={1.4} fill={c} /><Circle cx={19} cy={12} r={1.4} fill={c} /></>);
      case 'star':
        return <Path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" {...p} />;
      case 'sparkle':
        return <Path d="M12 3c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7zM19 16c.3 1.7.9 2.4 2.5 2.6-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.2 2.2-.9 2.5-2.6z" {...p} />;
      case 'palette':
        return (<><Path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.6-2.1-.5-1.3.4-2.4 1.8-2.4H18a3 3 0 0 0 3-3c0-5.6-4-10.5-9-10.5z" {...p} /><Circle cx={7.5} cy={11} r={1.2} fill={c} /><Circle cx={10.5} cy={7} r={1.2} fill={c} /><Circle cx={15} cy={7.5} r={1.2} fill={c} /></>);
      case 'shield':
        return <Path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z" {...p} />;
      case 'flag':
        return <Path d="M5 21V4M5 4.5c5-2.5 8 2.5 14 0v9c-6 2.5-9-2.5-14 0" {...p} />;
      case 'trash':
        return <Path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" {...p} />;
      case 'camera':
        return (<><Path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" {...p} /><Circle cx={12} cy={13} r={3.5} {...p} /></>);
      case 'arrowIn':
        return <Path d="M17 7 7 17M7 9v8h8" {...p} />;
      case 'arrowOut':
        return <Path d="M7 17 17 7M9 7h8v8" {...p} />;
    }
  })();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
