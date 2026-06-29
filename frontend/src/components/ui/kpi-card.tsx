import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/hooks/use-theme';

type Tone = 'primary' | 'success' | 'warning' | 'critical' | 'info' | 'navy';

export function KpiCard({
  label, value, delta, icon: Icon, tone = 'primary', sub,
}: {
  label: string; value: string | number; delta?: number; icon?: LucideIcon;
  tone?: Tone; sub?: string;
}) {
  const colors = useTheme();
  const toneColor: Record<Tone, string> = {
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
    critical: colors.critical,
    info: colors.info,
    navy: colors.navy,
  };
  const color = toneColor[tone];

  return (
    <Card style={styles.card}>
      <View style={styles.headRow}>
        {Icon && (
          <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
            <Icon size={18} color={color} strokeWidth={1.75} />
          </View>
        )}
        <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={2}>{label}</Text>
      </View>

      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      {sub && <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>{sub}</Text>}

      {typeof delta === 'number' && (
        <View style={styles.deltaRow}>
          <View style={[styles.deltaPill, { backgroundColor: (delta >= 0 ? colors.success : colors.critical) + '18' }]}>
            {delta >= 0
              ? <ArrowUpRight size={11} color={colors.success} strokeWidth={2.5} />
              : <ArrowDownRight size={11} color={colors.critical} strokeWidth={2.5} />}
            <Text style={[styles.deltaText, { color: delta >= 0 ? colors.success : colors.critical }]}>
              {Math.abs(delta)}%
            </Text>
          </View>
          <Text style={[styles.deltaCaption, { color: colors.textSecondary }]}>vs last month</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexGrow: 1, flexBasis: '47%', minWidth: 150 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontSize: 11.5, fontWeight: '600', flex: 1 },
  value: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 11.5, marginTop: 4 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  deltaText: { fontSize: 11, fontWeight: '700' },
  deltaCaption: { fontSize: 11 },
});
