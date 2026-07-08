import { Stack, useLocalSearchParams } from 'expo-router';
import {
  Activity, AlertTriangle, Bell, CheckCircle2, ClipboardList,
  FileText, HeartPulse, MessageSquare, Phone, Sparkles,
  Thermometer, Timer, TrendingDown, TrendingUp, Video, Weight, Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import {
  api,
  type AlertEvent, type Patient, type PatientReading,
  type ReadingType, type SmartMeterDetail, type SmartMeterAddress,
} from '@/lib/api';

// ── Helpers ────────────────────────────────────────────────────────────────

function ageFromDob(dob: string | null): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return `${age} yrs`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtAddress(addr: SmartMeterAddress | null | undefined): string {
  if (!addr) return '—';
  const parts = [addr.address1, addr.address2, addr.city, addr.state, addr.zip, addr.country].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function enrollTone(s: string): 'success' | 'warning' | 'muted' | 'critical' {
  if (s === 'active')  return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'hold')    return 'muted';
  return 'critical';
}

function riskTone(r: string): 'success' | 'info' | 'warning' | 'critical' {
  if (r === 'low')    return 'success';
  if (r === 'medium') return 'info';
  if (r === 'high')   return 'warning';
  return 'critical';
}

function alertStatusTone(s: string): 'success' | 'warning' | 'muted' | 'info' {
  if (s === 'resolved')  return 'success';
  if (s === 'escalated') return 'warning';
  if (s === 'assigned')  return 'info';
  return 'muted';
}

const READING_TYPE_ICONS: Record<ReadingType, LucideIcon> = {
  blood_pressure: HeartPulse,
  glucose:        Activity,
  weight:         Weight,
  spo2:           Activity,
  heart_rate:     HeartPulse,
  temperature:    Thermometer,
  unknown:        Activity,
};

const READING_COLORS: Record<ReadingType, string> = {
  blood_pressure: '#DC2626',
  glucose:        '#D97706',
  weight:         '#7C3AED',
  spo2:           '#0284C7',
  heart_rate:     '#DC2626',
  temperature:    '#D97706',
  unknown:        '#6B7280',
};

const DAYS_OPTIONS = [7, 30, 90] as const;
type DaysOption = typeof DAYS_OPTIONS[number];

const TABS = ['Info', 'Readings', 'Alerts', 'Devices', 'Notes'] as const;
type Tab = typeof TABS[number];

// ── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={s.infoItem}>
      <Text style={[s.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[s.infoValue, { color: colors.text }]} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

function SectionLabel({ text, colors }: { text: string; colors: any }) {
  return (
    <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>{text.toUpperCase()}</Text>
  );
}

// ── Reading sparkline (simple bar chart) ───────────────────────────────────

function ReadingSparkline({ readings, color }: { readings: PatientReading[]; color: string }) {
  const vals = readings.map((r) => r.value ?? 0).filter((v) => v > 0);
  if (vals.length < 2) return null;
  const max = Math.max(...vals);
  const last8 = readings.slice(0, 8).reverse();

  return (
    <View style={spark.wrap}>
      {last8.map((r, i) => {
        const h = Math.max(4, ((r.value ?? 0) / max) * 44);
        return (
          <View key={r.id + i} style={spark.col}>
            <View style={[spark.bar, { height: h, backgroundColor: color + (r.flagged ? 'ff' : '80') }]} />
          </View>
        );
      })}
    </View>
  );
}
const spark = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44, marginTop: 8 },
  col:  { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:  { width: '100%', borderRadius: 3, minHeight: 4 },
});

// ── Reading card ───────────────────────────────────────────────────────────

function ReadingCard({ reading, colors }: { reading: PatientReading; colors: any }) {
  const Icon  = READING_TYPE_ICONS[reading.type];
  const color = READING_COLORS[reading.type];

  return (
    <View style={[rc.root, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={[rc.stripe, { backgroundColor: reading.flagged ? '#DC2626' : color }]} />
      <View style={rc.body}>
        <View style={rc.topRow}>
          <View style={[rc.iconWrap, { backgroundColor: color + '15' }]}>
            <Icon size={14} color={color} strokeWidth={1.75} />
          </View>
          <Text style={[rc.label, { color: colors.textSecondary }]}>{reading.label}</Text>
          {reading.flagged && (
            <View style={rc.flagBadge}>
              <Zap size={9} color="#DC2626" />
              <Text style={rc.flagText}>Flagged</Text>
            </View>
          )}
          <Text style={[rc.time, { color: colors.textSecondary }]}>{timeAgo(reading.timestamp)}</Text>
        </View>
        <Text style={[rc.value, { color: reading.flagged ? '#DC2626' : colors.text }]}>
          {reading.displayValue}
        </Text>
        {reading.type === 'blood_pressure' && reading.systolic && reading.diastolic && (
          <View style={rc.bpRow}>
            <Text style={[rc.bpItem, { color: colors.textSecondary }]}>
              Systolic {reading.systolic}
            </Text>
            <Text style={[rc.bpItem, { color: colors.textSecondary }]}>
              Diastolic {reading.diastolic}
            </Text>
            {reading.pulse && (
              <Text style={[rc.bpItem, { color: colors.textSecondary }]}>
                Pulse {reading.pulse} bpm
              </Text>
            )}
          </View>
        )}
        <Text style={[rc.dateText, { color: colors.textSecondary }]}>
          {fmtDateTime(reading.timestamp)}
          {reading.deviceId ? ` · ${reading.deviceId}` : ''}
          {' · '}{reading.source === 'tenovi' ? 'Tenovi' : 'SmartMeter'}
        </Text>
      </View>
    </View>
  );
}
const rc = StyleSheet.create({
  root:    { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  stripe:  { width: 4 },
  body:    { flex: 1, padding: 12, gap: 4 },
  topRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap:{ width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label:   { flex: 1, fontSize: 11, fontWeight: '600' },
  flagBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DC262615', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  flagText:{ fontSize: 9, fontWeight: '800', color: '#DC2626' },
  time:    { fontSize: 10.5 },
  value:   { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  bpRow:   { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  bpItem:  { fontSize: 11 },
  dateText:{ fontSize: 10.5 },
});

// ── Readings Tab ───────────────────────────────────────────────────────────

function ReadingsTab({
  patientId, source, colors,
}: { patientId: string; source: 'smartmeter' | 'tenovi'; colors: any }) {
  const { session } = useAuth();
  const [days, setDays]         = useState<DaysOption>(30);
  const [readings, setReadings] = useState<PatientReading[] | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [typeFilter, setTypeFilter] = useState<ReadingType | 'all'>('all');

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getPatientReadings(session.token, patientId, days);
      setReadings(res.readings);
    } catch {
      setError('Could not load readings.');
    } finally {
      setLoading(false);
    }
  }, [session, patientId, days]);

  useEffect(() => { load(); }, [load]);

  const types: ReadingType[] = useMemo(() => {
    if (!readings) return [];
    return [...new Set(readings.map((r) => r.type))].filter((t) => t !== 'unknown');
  }, [readings]);

  const filtered = useMemo(() =>
    readings
      ? typeFilter === 'all' ? readings : readings.filter((r) => r.type === typeFilter)
      : [],
    [readings, typeFilter],
  );

  // Latest reading per type for summary cards
  const summaryByType = useMemo(() => {
    const map = new Map<ReadingType, PatientReading>();
    if (!readings) return map;
    for (const r of readings) {
      if (!map.has(r.type)) map.set(r.type, r);
    }
    return map;
  }, [readings]);

  // Trend: compare latest vs previous same-type reading
  function trend(type: ReadingType): 'up' | 'down' | 'flat' {
    if (!readings) return 'flat';
    const same = readings.filter((r) => r.type === type && r.value != null);
    if (same.length < 2) return 'flat';
    const diff = (same[0].value ?? 0) - (same[1].value ?? 0);
    if (diff > 2) return 'up';
    if (diff < -2) return 'down';
    return 'flat';
  }

  const flaggedCount = filtered.filter((r) => r.flagged).length;

  return (
    <View>
      {/* Days filter */}
      <View style={[rt.dayRow]}>
        {DAYS_OPTIONS.map((d) => (
          <Pressable
            key={d}
            onPress={() => setDays(d)}
            style={[rt.dayChip, { borderColor: days === d ? colors.primary : colors.border, backgroundColor: days === d ? colors.primary : colors.card }]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: days === d ? '#052B00' : colors.textSecondary }}>
              {d}d
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : error ? (
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text>
        </Card>
      ) : !readings || readings.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 36, gap: 8 }}>
          <HeartPulse size={28} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
            No readings in the last {days} days.
          </Text>
        </Card>
      ) : (
        <>
          {/* Summary tiles per reading type */}
          {types.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4, marginBottom: 12 }}>
              {types.map((type) => {
                const r = summaryByType.get(type)!;
                const color = READING_COLORS[type];
                const Icon = READING_TYPE_ICONS[type];
                const t = trend(type);
                const typeReadings = readings.filter((x) => x.type === type);
                return (
                  <Pressable
                    key={type}
                    onPress={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                    style={[rt.sumTile, {
                      backgroundColor: typeFilter === type ? color + '12' : colors.card,
                      borderColor: typeFilter === type ? color : colors.border,
                    }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[rt.sumIcon, { backgroundColor: color + '15' }]}>
                        <Icon size={13} color={color} strokeWidth={1.75} />
                      </View>
                      <Text style={[rt.sumLabel, { color: colors.textSecondary }]}>{r.label}</Text>
                    </View>
                    <Text style={[rt.sumValue, { color: color }]}>{r.displayValue}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {t === 'up'   && <TrendingUp size={11} color="#DC2626" />}
                      {t === 'down' && <TrendingDown size={11} color="#059669" />}
                      <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                        {typeReadings.length} readings
                      </Text>
                    </View>
                    <ReadingSparkline readings={typeReadings} color={color} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Type filter chips */}
          {types.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
              <Pressable
                onPress={() => setTypeFilter('all')}
                style={[rt.typeChip, { borderColor: typeFilter === 'all' ? colors.primary : colors.border, backgroundColor: typeFilter === 'all' ? colors.primary + '14' : 'transparent' }]}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: typeFilter === 'all' ? colors.primary : colors.textSecondary }}>
                  All ({readings.length})
                </Text>
              </Pressable>
              {types.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                  style={[rt.typeChip, {
                    borderColor: typeFilter === type ? READING_COLORS[type] : colors.border,
                    backgroundColor: typeFilter === type ? READING_COLORS[type] + '14' : 'transparent',
                  }]}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: typeFilter === type ? READING_COLORS[type] : colors.textSecondary }}>
                    {summaryByType.get(type)?.label} ({readings.filter((r) => r.type === type).length})
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Flagged alert */}
          {flaggedCount > 0 && (
            <View style={[rt.flagBanner, { backgroundColor: '#DC262612', borderColor: '#DC262640' }]}>
              <AlertTriangle size={14} color="#DC2626" />
              <Text style={{ color: '#DC2626', fontSize: 12.5, fontWeight: '700' }}>
                {flaggedCount} flagged reading{flaggedCount > 1 ? 's' : ''} in this period
              </Text>
            </View>
          )}

          {/* Readings list */}
          {filtered.map((r) => <ReadingCard key={r.id} reading={r} colors={colors} />)}
        </>
      )}
    </View>
  );
}
const rt = StyleSheet.create({
  dayRow:   { flexDirection: 'row', gap: 6, marginBottom: 12 },
  dayChip:  { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 7 },
  sumTile:  { width: 160, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  sumIcon:  { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sumLabel: { fontSize: 10.5, fontWeight: '600' },
  sumValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  typeChip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 6 },
  flagBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, marginBottom: 10 },
});

// ── Alerts Tab ─────────────────────────────────────────────────────────────

function AlertsTab({ patientId, colors }: { patientId: string; colors: any }) {
  const { session } = useAuth();
  const [alerts, setAlerts] = useState<AlertEvent[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    api.getPatientAlerts(session.token, patientId)
      .then((r) => setAlerts(r.alerts))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [session, patientId]);

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;
  if (!alerts || alerts.length === 0) {
    return (
      <Card style={{ alignItems: 'center', paddingVertical: 36, gap: 8 }}>
        <CheckCircle2 size={28} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No alerts for this patient.</Text>
      </Card>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {alerts.map((a) => (
        <View key={a.id} style={[at.root, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[at.stripe, { backgroundColor: a.tier === 'CRITICAL' ? '#DC2626' : '#D97706' }]} />
          <View style={at.body}>
            <View style={at.topRow}>
              <View style={[at.tierBadge, { backgroundColor: a.tier === 'CRITICAL' ? '#DC262615' : '#D9770615' }]}>
                {a.tier === 'CRITICAL'
                  ? <Zap size={10} color="#DC2626" />
                  : <AlertTriangle size={10} color="#D97706" />}
                <Text style={[at.tierText, { color: a.tier === 'CRITICAL' ? '#DC2626' : '#D97706' }]}>{a.tier}</Text>
              </View>
              <StatusPill tone={alertStatusTone(a.status)}>
                {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
              </StatusPill>
            </View>
            <Text style={[at.alertType, { color: colors.text }]}>{a.alert_type}</Text>
            {a.value && (
              <Text style={[at.alertValue, { color: colors.textSecondary }]}>
                {a.value} {a.unit} · threshold {a.threshold} {a.unit}
              </Text>
            )}
            <Text style={[at.alertDate, { color: colors.textSecondary }]}>
              {fmtDateTime(a.reading_time ?? a.created_at)}
              {a.resolved_at ? ` · Resolved ${timeAgo(a.resolved_at)}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
const at = StyleSheet.create({
  root:     { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  stripe:   { width: 4 },
  body:     { flex: 1, padding: 12, gap: 5 },
  topRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  tierText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },
  alertType: { fontSize: 14, fontWeight: '700' },
  alertValue: { fontSize: 12 },
  alertDate:  { fontSize: 11, marginTop: 2 },
});

// ── Devices Tab ────────────────────────────────────────────────────────────

function DevicesTab({ patient, colors }: { patient: Patient; colors: any }) {
  return (
    <Card style={{ gap: 10 }}>
      <SectionLabel text="Monitoring System" colors={colors} />
      <View style={[dv.row, { borderColor: colors.border }]}>
        <View style={[dv.iconWrap, { backgroundColor: colors.primary + '15' }]}>
          <HeartPulse size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[dv.name, { color: colors.text }]}>
            {patient.source === 'tenovi' ? 'Tenovi RPM Device' : 'SmartMeter Device'}
          </Text>
          <Text style={[dv.sub, { color: colors.textSecondary }]}>
            Program: {patient.program} · {patient.source === 'tenovi' ? 'Tenovi' : 'SmartMeter'}
          </Text>
          {patient.external_patient_id && (
            <Text style={[dv.sub, { color: colors.textSecondary }]}>
              Device ID: {patient.external_patient_id}
            </Text>
          )}
        </View>
        <StatusPill tone={patient.enrollment_status === 'active' ? 'success' : 'muted'}>
          {patient.enrollment_status}
        </StatusPill>
      </View>
      {patient.enrolled_at && (
        <View style={{ marginTop: 4 }}>
          <InfoRow label="Enrolled" value={fmtDate(patient.enrolled_at)} colors={colors} />
          {patient.disenrolled_at && (
            <InfoRow label="Disenrolled" value={fmtDate(patient.disenrolled_at)} colors={colors} />
          )}
        </View>
      )}
    </Card>
  );
}
const dv = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconWrap:{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name:    { fontSize: 13.5, fontWeight: '700' },
  sub:     { fontSize: 11.5, marginTop: 2 },
});

// ── Main patient profile ───────────────────────────────────────────────────

export default function PatientDetail() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const colors = useTheme();
  const { session } = useAuth();
  const [tab, setTab]         = useState<Tab>('Info');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [smDetail, setSmDetail] = useState<SmartMeterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPatient = useCallback(async (isRefresh = false) => {
    if (!session || !patientId) return;
    if (isRefresh) setRefreshing(true);
    try {
      const r = await api.getPatient(session.token, patientId);
      setPatient(r.patient);
      setSmDetail(r.smDetail ?? null);
    } catch { setPatient(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, [session, patientId]);

  useEffect(() => { loadPatient(); }, [loadPatient]);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (!patient) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Text style={[s.notFound, { color: colors.text }]}>Patient not found</Text>
      </View>
    );
  }

  const nameParts = patient.full_name.trim().split(' ');
  const initials = ((nameParts[0]?.[0] ?? '') + (nameParts[nameParts.length - 1]?.[0] ?? '')).toUpperCase();

  // Prefer live SmartMeter detail over cached DB fields
  const dob     = smDetail?.dob     ?? patient.dob;
  const gender  = smDetail?.gender  ?? (patient.sex === 'M' ? 'Male' : patient.sex === 'F' ? 'Female' : null);
  const language = smDetail?.language ?? patient.language;
  const cellPhone = smDetail?.cell_phone ?? patient.phone;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPatient(true)} tintColor={colors.primary} />}
    >
      <Stack.Screen options={{ title: patient.full_name, headerBackTitle: 'Patients' }} />

      {/* ── Hero card ───────────────────────────────────────────────────── */}
      <Card style={s.heroCard}>
        <View style={s.heroTop}>
          <View style={[s.avatar, { backgroundColor: colors.primary + '1a' }]}>
            <Text style={[s.avatarText, { color: colors.primary }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.name, { color: colors.text }]}>{patient.full_name}</Text>
            <Text style={[s.heroDemog, { color: colors.textSecondary }]}>
              {ageFromDob(dob)}
              {gender ? ` · ${gender}` : ''}
              {dob ? ` · DOB ${dob}` : ''}
            </Text>
            <View style={s.badgeRow}>
              <StatusPill tone={enrollTone(patient.enrollment_status)}>
                {patient.enrollment_status}
              </StatusPill>
              <StatusPill tone="muted">{patient.program}</StatusPill>
              <StatusPill tone={riskTone(patient.risk)}>{patient.risk} risk</StatusPill>
              <StatusPill tone={patient.source === 'tenovi' ? 'info' : 'muted'}>
                {patient.source === 'tenovi' ? 'Tenovi' : 'SmartMeter'}
              </StatusPill>
            </View>
          </View>
        </View>

        {/* Quick metrics row */}
        <View style={[s.quickMetrics, { borderTopColor: colors.border }]}>
          {[
            { label: 'Clinic',   value: patient.clinic_name ?? '—' },
            { label: 'MRN',      value: patient.mrn ?? '—' },
            { label: 'Language', value: patient.language },
            { label: 'Enrolled', value: fmtDate(patient.enrolled_at) },
          ].map(({ label, value }) => (
            <View key={label} style={s.metricItem}>
              <Text style={[s.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[s.metricValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Diagnoses */}
        {patient.diagnoses.length > 0 && (
          <View style={s.chipsRow}>
            {patient.diagnoses.map((d, i) => (
              <View key={i} style={[s.chip, { backgroundColor: colors.accent }]}>
                <Text style={[s.chipText, { color: colors.text }]}>{d}</Text>
              </View>
            ))}
            {patient.icd10_codes.map((c, i) => (
              <View key={`icd-${i}`} style={[s.chip, { backgroundColor: colors.border }]}>
                <Text style={[s.chipText, { color: colors.textSecondary }]}>{c}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <Card>
        <SectionLabel text="Quick Actions" colors={colors} />
        <View style={s.actionsGrid}>
          {([
            { icon: Phone,         label: 'Call'     },
            { icon: MessageSquare, label: 'SMS'      },
            { icon: Video,         label: 'Video'    },
            { icon: FileText,      label: 'Note'     },
            { icon: AlertTriangle, label: 'Escalate' },
            { icon: ClipboardList, label: 'Task'     },
          ] as { icon: LucideIcon; label: string }[]).map(({ icon: Icon, label }) => (
            <Pressable key={label} style={[s.actionBtn, { borderColor: colors.border }]}>
              <Icon size={16} color={colors.primary} strokeWidth={1.75} />
              <Text style={[s.actionLabel, { color: colors.text }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* ── AI summary ───────────────────────────────────────────────────── */}
      <Card style={[s.aiCard, { backgroundColor: colors.primary + '0c', borderColor: colors.primary + '30' }]}>
        <View style={s.aiHead}>
          <Sparkles size={14} color={colors.primary} />
          <Text style={[s.aiEyebrow, { color: colors.primary }]}>AI PATIENT SUMMARY</Text>
        </View>
        <Text style={[s.aiBody, { color: colors.text }]}>
          {nameParts[0]} is a {ageFromDob(dob)} {gender ? gender.toLowerCase() : 'patient'} enrolled in {patient.program}
          {patient.diagnoses.length > 0 ? ` for ${patient.diagnoses.slice(0, 2).join(', ')}` : ''}.
          {' '}Enrollment status is {patient.enrollment_status}; risk classified as {patient.risk}.
          Monitored via {patient.source === 'tenovi' ? 'Tenovi RPM' : 'SmartMeter'}.
          {patient.insurance_payer ? ` Insurance: ${patient.insurance_payer}.` : ''}
        </Text>
      </Card>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabsRow}
        style={{ marginBottom: 2 }}
      >
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[s.tabPill, {
              backgroundColor: tab === t ? colors.primary : colors.card,
              borderColor: tab === t ? colors.primary : colors.border,
            }]}
          >
            {t === 'Readings' && <HeartPulse size={12} color={tab === t ? '#052B00' : colors.textSecondary} />}
            {t === 'Alerts'   && <Bell size={12} color={tab === t ? '#052B00' : colors.textSecondary} />}
            {t === 'Devices'  && <Activity size={12} color={tab === t ? '#052B00' : colors.textSecondary} />}
            {t === 'Notes'    && <FileText size={12} color={tab === t ? '#052B00' : colors.textSecondary} />}
            <Text style={[s.tabText, { color: tab === t ? '#052B00' : colors.textSecondary }]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      {tab === 'Info' && (
        <View style={{ gap: 12 }}>
          {/* General */}
          <Card style={{ gap: 14 }}>
            <SectionLabel text="General" colors={colors} />
            <View style={s.infoGrid}>
              {smDetail ? (
                <>
                  <InfoRow label="First Name"   value={smDetail.first_name ?? '—'}   colors={colors} />
                  <InfoRow label="Middle Name"  value={smDetail.middle_name ?? '—'}  colors={colors} />
                  <InfoRow label="Last Name"    value={smDetail.last_name ?? '—'}    colors={colors} />
                  {smDetail.suffix && <InfoRow label="Suffix" value={smDetail.suffix} colors={colors} />}
                  <InfoRow label="Gender"       value={smDetail.gender ?? '—'}       colors={colors} />
                  <InfoRow label="Race"         value={smDetail.race ?? '—'}         colors={colors} />
                  <InfoRow label="Date of Birth" value={smDetail.dob ?? '—'}         colors={colors} />
                  <InfoRow label="Age"          value={ageFromDob(smDetail.dob)}     colors={colors} />
                  <InfoRow label="Language"     value={smDetail.language ?? '—'}     colors={colors} />
                  <InfoRow label="Time Zone"    value={smDetail.time_zone ?? '—'}    colors={colors} />
                </>
              ) : (
                <>
                  <InfoRow label="Full Name"  value={patient.full_name}           colors={colors} />
                  <InfoRow label="DOB"        value={dob ?? '—'}                  colors={colors} />
                  <InfoRow label="Age"        value={ageFromDob(dob)}             colors={colors} />
                  <InfoRow label="Gender"     value={gender ?? '—'}               colors={colors} />
                  <InfoRow label="Language"   value={language}                    colors={colors} />
                </>
              )}
            </View>
          </Card>

          {/* Contact */}
          <Card style={{ gap: 14 }}>
            <SectionLabel text="Contact" colors={colors} />
            <View style={s.infoGrid}>
              {smDetail ? (
                <>
                  <InfoRow label="Cell Phone"  value={smDetail.cell_phone ?? '—'}  colors={colors} />
                  <InfoRow label="Home Phone"  value={smDetail.home_phone ?? '—'}  colors={colors} />
                  <InfoRow label="Email"       value={smDetail.email ?? '—'}       colors={colors} />
                  <InfoRow label="Msg Delivery" value={smDetail.message_delivery_preference ?? '—'} colors={colors} />
                  {smDetail.preferred_phone && <InfoRow label="Preferred Phone" value={smDetail.preferred_phone} colors={colors} />}
                  {smDetail.preferred_time_of_day && <InfoRow label="Preferred Time" value={smDetail.preferred_time_of_day} colors={colors} />}
                  {smDetail.preferred_day_of_week && <InfoRow label="Preferred Day"  value={smDetail.preferred_day_of_week}  colors={colors} />}
                </>
              ) : (
                <InfoRow label="Phone" value={patient.phone ?? '—'} colors={colors} />
              )}
            </View>

            {smDetail && (smDetail.shipping_address || smDetail.physical_address) && (
              <>
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <SectionLabel text="Address" colors={colors} />
                <View style={{ gap: 10 }}>
                  {smDetail.shipping_address && (
                    <View>
                      <Text style={[s.infoLabel, { color: colors.textSecondary, marginBottom: 2 }]}>SHIPPING</Text>
                      <Text style={[s.infoValue, { color: colors.text }]}>{fmtAddress(smDetail.shipping_address)}</Text>
                    </View>
                  )}
                  {smDetail.physical_address && (
                    <View>
                      <Text style={[s.infoLabel, { color: colors.textSecondary, marginBottom: 2 }]}>PHYSICAL</Text>
                      <Text style={[s.infoValue, { color: colors.text }]}>{fmtAddress(smDetail.physical_address)}</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </Card>

          {/* Enrollment */}
          <Card style={{ gap: 14 }}>
            <SectionLabel text="Enrollment" colors={colors} />
            <View style={s.infoGrid}>
              <InfoRow label="Status"     value={patient.enrollment_status}      colors={colors} />
              <InfoRow label="Program"    value={patient.program}                colors={colors} />
              <InfoRow label="Risk"       value={patient.risk}                   colors={colors} />
              <InfoRow label="Clinic"     value={patient.clinic_name ?? '—'}     colors={colors} />
              <InfoRow label="MRN"        value={patient.mrn ?? '—'}             colors={colors} />
              <InfoRow label="Ext. ID"    value={patient.external_patient_id}    colors={colors} />
              <InfoRow label="Enrolled"   value={fmtDate(patient.enrolled_at)}   colors={colors} />
              {patient.disenrolled_at && (
                <InfoRow label="Disenrolled" value={fmtDate(patient.disenrolled_at)} colors={colors} />
              )}
            </View>
          </Card>

          {/* Insurance */}
          {patient.insurance_payer && (
            <Card style={{ gap: 14 }}>
              <SectionLabel text="Insurance" colors={colors} />
              <View style={s.infoGrid}>
                <InfoRow label="Payer"  value={patient.insurance_payer}        colors={colors} />
                <InfoRow label="Class"  value={patient.insurance_class ?? '—'} colors={colors} />
              </View>
            </Card>
          )}

          {/* Diagnoses */}
          {(patient.diagnoses.length > 0 || patient.icd10_codes.length > 0) && (
            <Card style={{ gap: 14 }}>
              <SectionLabel text="Diagnoses" colors={colors} />
              <View style={s.chipsRow}>
                {patient.diagnoses.map((d, i) => (
                  <View key={i} style={[s.chip, { backgroundColor: colors.accent }]}>
                    <Text style={[s.chipText, { color: colors.text }]}>{d}</Text>
                  </View>
                ))}
              </View>
              {patient.icd10_codes.length > 0 && (
                <View style={s.chipsRow}>
                  {patient.icd10_codes.map((c, i) => (
                    <View key={i} style={[s.chip, { backgroundColor: colors.border }]}>
                      <Text style={[s.chipText, { color: colors.textSecondary }]}>{c}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          )}
        </View>
      )}

      {tab === 'Readings' && (
        <ReadingsTab
          patientId={patient.id}
          source={patient.source}
          colors={colors}
        />
      )}

      {tab === 'Alerts' && (
        <AlertsTab patientId={patient.id} colors={colors} />
      )}

      {tab === 'Devices' && (
        <DevicesTab patient={patient} colors={colors} />
      )}

      {tab === 'Notes' && (
        <Card style={{ alignItems: 'center', paddingVertical: 36, gap: 8 }}>
          <FileText size={26} color={colors.textSecondary} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Clinical Notes</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12.5, textAlign: 'center' }}>
            Time-tracked SOAP notes and provider sign-offs coming soon.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content:  { padding: 16, gap: 12, paddingBottom: 60 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 16, fontWeight: '700' },

  // Hero
  heroCard: { gap: 0 },
  heroTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar:   { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 20, fontWeight: '800' },
  name:     { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  heroDemog:{ fontSize: 12, marginTop: 3 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  quickMetrics: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  metricItem: { width: '47%' },
  metricLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  metricValue: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip:     { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '600' },

  // Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actionBtn:   { width: '30.5%', alignItems: 'center', gap: 5, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12 },
  actionLabel: { fontSize: 10.5, fontWeight: '600' },

  // AI
  aiCard:    {},
  aiHead:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiEyebrow: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 },
  aiBody:    { fontSize: 12.5, lineHeight: 19 },

  // Tabs
  tabsRow:   { gap: 6, paddingVertical: 2 },
  tabPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  tabText:   { fontSize: 12.5, fontWeight: '700' },

  // Info grid
  infoGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoItem:  { width: '47%' },
  infoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: '500' },
  divider:   { height: StyleSheet.hairlineWidth, marginVertical: 4 },

  // Section
  sectionLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8 },
});
