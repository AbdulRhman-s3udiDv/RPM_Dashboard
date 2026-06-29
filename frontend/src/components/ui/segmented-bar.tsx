import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";

export function SegmentedBar({ data }: { data: { name: string; value: number; color: string }[] }) {
  const colors = useTheme();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <View>
      <View style={[styles.track, { backgroundColor: colors.muted }]}>
        {data.map((d, i) => (
          <View
            key={d.name}
            style={{
              flex: d.value / total,
              backgroundColor: d.color,
              borderTopLeftRadius: i === 0 ? 999 : 0,
              borderBottomLeftRadius: i === 0 ? 999 : 0,
              borderTopRightRadius: i === data.length - 1 ? 999 : 0,
              borderBottomRightRadius: i === data.length - 1 ? 999 : 0,
            }}
          />
        ))}
      </View>
      <View style={styles.legend}>
        {data.map((d) => (
          <View key={d.name} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: d.color }]} />
            <Text style={[styles.legendLabel, { color: colors.text }]}>{d.name}</Text>
            <Text style={[styles.legendValue, { color: colors.textSecondary }]}>
              {d.value.toLocaleString()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", height: 10, borderRadius: 999, overflow: "hidden" },
  legend: { marginTop: 16, gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  legendLabel: { flex: 1, fontSize: 12.5, fontWeight: "600" },
  legendValue: { fontSize: 12 },
});
