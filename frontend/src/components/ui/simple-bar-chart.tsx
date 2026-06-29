import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";

export function SimpleBarChart({
  data, color, height = 120, formatValue,
}: { data: { label: string; value: number }[]; color: string; height?: number; formatValue?: (v: number) => string }) {
  const colors = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <View style={[styles.row, { height: height + 32 }]}>
      {data.map((d) => {
        const barH = Math.max(4, (d.value / max) * height);
        return (
          <View key={d.label} style={styles.col}>
            {d.value > 0 && (
              <Text style={[styles.valueLabel, { color }]}>
                {formatValue ? formatValue(d.value) : d.value}
              </Text>
            )}
            <View style={[styles.track, { height }]}>
              <View
                style={[
                  styles.bar,
                  { height: barH, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  col: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  valueLabel: { fontSize: 9, fontWeight: "700", marginBottom: 3 },
  track: { width: "100%", justifyContent: "flex-end", alignItems: "center" },
  bar: { width: "55%", borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  label: { fontSize: 9.5, marginTop: 6 },
});
