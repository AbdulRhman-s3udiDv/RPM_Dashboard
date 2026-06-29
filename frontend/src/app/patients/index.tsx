import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusPill, complianceTone, riskTone } from '@/components/ui/status-pill';
import { useTheme } from '@/hooks/use-theme';
import { clinics } from '@/data/clinics';
import { patients, type Program } from '@/data/patients';

const programs: (Program | 'All')[] = ['All', 'RPM', 'RTM', 'CCM', 'PCM'];

export default function PatientsScreen() {
  const colors = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [prog, setProg] = useState<typeof programs[number]>('All');

  const filtered = useMemo(
    () => patients.filter((p) =>
      (q === '' || p.name.toLowerCase().includes(q.toLowerCase())) &&
      (prog === 'All' || p.program === prog)),
    [q, prog],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ marginBottom: 4 }}>
            <PageHeader
              eyebrow="Registry"
              title="Patient Registry"
              description={`${filtered.length.toLocaleString()} of ${patients.length} patients across the platform`}
            />
            <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Search size={15} color={colors.textSecondary} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search by patient name…"
                placeholderTextColor={colors.textSecondary}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow} contentContainerStyle={{ gap: 6 }}>
              {programs.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setProg(p)}
                  style={[
                    styles.filterPill,
                    { borderColor: colors.border, backgroundColor: prog === p ? colors.primary : colors.card },
                  ]}>
                  <Text style={[styles.filterPillText, { color: prog === p ? '#fff' : colors.textSecondary }]}>{p}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item: p }) => {
          const clinic = clinics.find((c) => c.id === p.clinicId)!;
          return (
            <Pressable onPress={() => router.push(`/patients/${p.id}`)}>
              <Card style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.text }]}>{p.name}</Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {p.age} · {p.sex} · {clinic.name}
                    </Text>
                  </View>
                  <View style={styles.badgesCol}>
                    <StatusPill tone={riskTone(p.risk)}>{p.risk}</StatusPill>
                    {p.alerts > 0 && <StatusPill tone="critical">{p.alerts} alert{p.alerts > 1 ? 's' : ''}</StatusPill>}
                  </View>
                </View>
                <View style={styles.rowMid}>
                  <Text style={[styles.programBadge, { borderColor: colors.border, color: colors.text }]}>{p.program}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{p.device}</Text>
                </View>
                <View style={styles.rowBottom}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.complianceLine}>
                      <Text style={[styles.metaSmall, { color: colors.textSecondary }]}>{p.readings}/16 readings · {p.minutes}/20 min</Text>
                      <StatusPill tone={complianceTone(p.compliance)}>{p.compliance.replace('_', ' ')}</StatusPill>
                    </View>
                    <View style={{ marginTop: 6 }}>
                      <ProgressBar value={p.billingReady} color={colors.primary} />
                    </View>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14, height: 40,
  },
  searchInput: { flex: 1, fontSize: 13 },
  pillsRow: { marginTop: 10 },
  filterPill: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 6 },
  filterPillText: { fontSize: 12, fontWeight: '600' },
  row: { gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badgesCol: { alignItems: 'flex-end', gap: 4 },
  name: { fontSize: 14.5, fontWeight: '700' },
  meta: { fontSize: 11.5, marginTop: 2 },
  metaSmall: { fontSize: 10.5 },
  rowMid: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  programBadge: { fontSize: 10.5, fontWeight: '700', borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  rowBottom: { flexDirection: 'row' },
  complianceLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
