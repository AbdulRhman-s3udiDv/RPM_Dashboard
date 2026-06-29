import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export type Tone = 'success' | 'warning' | 'critical' | 'info' | 'muted' | 'primary';

export function StatusPill({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  const colors = useTheme();
  const toneColor: Record<Tone, string> = {
    success: colors.success,
    warning: colors.warning,
    critical: colors.critical,
    info: colors.info,
    primary: colors.primary,
    muted: colors.mutedForeground,
  };
  const color = toneColor[tone];
  const textColor = tone === 'warning' ? colors.warningForeground : color;
  return (
    <View style={[styles.pill, { backgroundColor: color + '15', borderColor: color + '35' }]}>
      <Text style={[styles.label, { color: textColor }]}>{children}</Text>
    </View>
  );
}

export function complianceTone(c: 'on_track' | 'at_risk' | 'non_compliant'): Tone {
  return c === 'on_track' ? 'success' : c === 'at_risk' ? 'warning' : 'critical';
}

export function riskTone(r: 'low' | 'medium' | 'high' | 'critical'): Tone {
  return r === 'low' ? 'success' : r === 'medium' ? 'info' : r === 'high' ? 'warning' : 'critical';
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
});
