import {
  AlertCircle, BookOpen, CheckCircle2, ChevronDown, Clock, Download,
  DollarSign, FileText, RefreshCw, Settings, Sliders, Trash2,
  TrendingUp, Users, Zap,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { Card } from '@/components/ui/card';
import { ChartCard } from '@/components/ui/chart-card';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { useRole } from '@/contexts/role-context';
import { useTheme } from '@/hooks/use-theme';
import {
  api, ApiError,
  type BillingRecord, type BillingRuleItem, type FeeScheduleItem,
  type DosOffsetItem, type RevenueBreakdown,
} from '@/lib/api';

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, 'success' | 'warning' | 'critical' | 'info' | 'muted'> = {
  pending:   'warning',
  generated: 'info',
  reviewed:  'info',
  signed:    'success',
  submitted: 'success',
  paid:      'success',
  voided:    'critical',
};

function fmt$(n: number | null | undefined): string {
  if (n == null) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtK(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'k';
  return '$' + n.toFixed(0);
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Main screen ────────────────────────────────────────────────────────────

type Tab = 'queue' | 'revenue' | 'admin';

export default function BillingScreen() {
  const colors  = useTheme();
  const { session } = useAuth();
  const { role }    = useRole();
  const isSuperAdmin = role === 'super_admin';

  const [tab, setTab] = useState<Tab>('queue');

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'queue',   label: 'Queue',   icon: FileText },
    { key: 'revenue', label: 'Revenue', icon: TrendingUp },
    ...(isSuperAdmin ? [{ key: 'admin' as Tab, label: 'Admin', icon: Settings }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Tab bar ── */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <PageHeader eyebrow="Revenue Ops" title="Billing & Compliance" compact />
        <View style={styles.tabRow}>
          {tabs.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[
                  styles.tabBtn,
                  active && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                ]}>
                <Icon size={13} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.textSecondary }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === 'queue'   && <QueueTab   session={session} colors={colors} isSuperAdmin={isSuperAdmin} />}
      {tab === 'revenue' && <RevenueTab session={session} colors={colors} isSuperAdmin={isSuperAdmin} />}
      {tab === 'admin'   && isSuperAdmin && <AdminTab session={session} colors={colors} />}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: QUEUE
// ═══════════════════════════════════════════════════════════════════════════

function QueueTab({ session, colors, isSuperAdmin }: {
  session: any; colors: ReturnType<typeof useTheme>; isSuperAdmin: boolean;
}) {
  const [records, setRecords]   = useState<BillingRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [month, setMonth]       = useState(currentMonth());
  const [program, setProgram]   = useState('');
  const [status, setStatus]     = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError('');
    try {
      const data = await api.getBillingQueue(session.token, { month, program: program || undefined, status: status || undefined });
      setRecords(data.records);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load billing queue.');
    } finally {
      setLoading(false);
    }
  }, [session, month, program, status]);

  useEffect(() => { load(); }, [load]);

  async function handleEvaluate() {
    if (!session) return;
    setEvaluating(true);
    try {
      await api.triggerBillingEvaluation(session.token);
      await load();
    } catch { } finally { setEvaluating(false); }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    if (!session) return;
    setPatchingId(id);
    try {
      const { record } = await api.updateBillingRecord(session.token, id, { status: newStatus });
      setRecords(prev => prev.map(r => r.id === id ? { ...r, ...record } : r));
    } catch { } finally { setPatchingId(null); }
  }

  // Summary cards
  const pending   = records.filter(r => r.status === 'pending').length;
  const reviewed  = records.filter(r => ['reviewed','generated'].includes(r.status)).length;
  const submitted = records.filter(r => ['submitted','paid'].includes(r.status)).length;
  const projected = records.reduce((s, r) => s + (r.projected_amount ?? 0), 0);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* KPI cards */}
      <View style={styles.kpiRow}>
        <KpiCard label="Pending Review"  icon={Clock}        tone="warning" value={String(pending)}   sub="Need action" />
        <KpiCard label="Ready to Submit" icon={CheckCircle2} tone="info"    value={String(reviewed)}  sub="Reviewed/signed" />
        <KpiCard label="Submitted/Paid"  icon={DollarSign}   tone="success" value={String(submitted)} sub="This month" />
        <KpiCard label="Projected"       icon={TrendingUp}   tone="primary" value={fmtK(projected)}   sub="This month" />
      </View>

      {/* Filter bar */}
      <Card>
        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Month</Text>
            <TextInput
              value={month}
              onChangeText={setMonth}
              placeholder="YYYY-MM"
              style={[styles.filterInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Program</Text>
            <FilterSelect
              value={program} onChange={setProgram} colors={colors}
              options={[
                { label: 'All', value: '' },
                { label: 'RPM', value: 'RPM' },
                { label: 'RTM', value: 'RTM' },
                { label: 'CCM', value: 'CCM' },
                { label: 'PCM', value: 'PCM' },
              ]}
            />
          </View>
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Status</Text>
            <FilterSelect
              value={status} onChange={setStatus} colors={colors}
              options={[
                { label: 'All', value: '' },
                { label: 'Pending', value: 'pending' },
                { label: 'Generated', value: 'generated' },
                { label: 'Reviewed', value: 'reviewed' },
                { label: 'Signed', value: 'signed' },
                { label: 'Submitted', value: 'submitted' },
                { label: 'Paid', value: 'paid' },
              ]}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <Pressable
              onPress={load}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
              <RefreshCw size={12} color="#fff" />
              <Text style={styles.actionBtnText}>Refresh</Text>
            </Pressable>
            {isSuperAdmin && (
              <Pressable
                onPress={handleEvaluate}
                disabled={evaluating}
                style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <Zap size={12} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                  {evaluating ? 'Running…' : 'Re-evaluate'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Card>

      {error ? (
        <Card><Text style={{ color: colors.critical, fontSize: 13 }}>{error}</Text></Card>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : records.length === 0 ? (
        <Card>
          <View style={styles.emptyBox}>
            <FileText size={28} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No billing records for this period.{'\n'}Run "Re-evaluate" to generate them from current patient data.
            </Text>
          </View>
        </Card>
      ) : (
        <BillingTable
          records={records}
          colors={colors}
          isSuperAdmin={isSuperAdmin}
          patchingId={patchingId}
          month={month}
          projected={projected}
          onStatusChange={handleStatusChange}
        />
      )}
    </ScrollView>
  );
}

// ── Billing Table (fills screen width — patient col stretches) ────────────

const FIXED_COLS_W = 60 + 65 + 80 + 90 + 72 + 52 + 80 + 85 + 90; // all cols except Patient

function BillingTable({ records, colors, isSuperAdmin, patchingId, month, projected, onStatusChange }: {
  records: BillingRecord[];
  colors: ReturnType<typeof useTheme>;
  isSuperAdmin: boolean;
  patchingId: string | null;
  month: string;
  projected: number;
  onStatusChange: (id: string, status: string) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  // Card has 16px margin each side + 16px body padding each side = 64px total offset
  const availableWidth = screenWidth - 64;
  const patientColW = Math.max(150, availableWidth - FIXED_COLS_W);
  const tableWidth  = patientColW + FIXED_COLS_W;

  const cols = [
    { label: 'Patient',   w: patientColW },
    { label: 'Program',   w: 60  },
    { label: 'CPT',       w: 65  },
    { label: 'DOS',       w: 80  },
    { label: 'Insurance', w: 90  },
    { label: 'Readings',  w: 72, right: true },
    { label: 'Mins',      w: 52, right: true },
    { label: 'Projected', w: 80, right: true },
    { label: 'Status',    w: 85  },
    { label: '',          w: 90  },
  ];

  return (
    <ChartCard
      title={`Billing Queue — ${month}`}
      subtitle={`${records.length} records · ${fmtK(projected)} projected`}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={tableWidth > availableWidth}
        style={{ marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}>
        <View style={{ width: Math.max(tableWidth, availableWidth) }}>
          {/* Header */}
          <View style={[styles.tableHead, { backgroundColor: colors.surface, borderRadius: 8 }]}>
            {cols.map(({ label, w, right }) => (
              <Text
                key={label || 'action'}
                style={[styles.th, { color: colors.textSecondary, width: w, textAlign: right ? 'right' : 'left' }]}>
                {label}
              </Text>
            ))}
          </View>

          {/* Rows */}
          {records.map((r, i) => (
            <View
              key={r.id}
              style={[
                styles.tableRow,
                { width: Math.max(tableWidth, availableWidth) },
                i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                patchingId === r.id && { opacity: 0.5 },
              ]}>
              <View style={{ width: patientColW }}>
                <Text style={[styles.cellPrimary, { color: colors.text }]} numberOfLines={1}>{r.patient_name}</Text>
                <Text style={[styles.cellSub,     { color: colors.textSecondary }]} numberOfLines={1}>{r.clinic_name ?? '—'}</Text>
              </View>
              <Text style={[styles.cell,     { color: colors.text,          width: 60  }]}>{r.program}</Text>
              <Text style={[styles.cellBold, { color: colors.primary,       width: 65  }]}>{r.cpt_code}</Text>
              <Text style={[styles.cell,     { color: colors.text,          width: 80  }]}>{fmtDate(r.dos)}</Text>
              <Text style={[styles.cell,     { color: colors.textSecondary, width: 90  }]} numberOfLines={1}>
                {r.insurance_type.replace('Medicare Advantage', 'MA')}
              </Text>
              <Text style={[styles.cellNum, { color: colors.text, width: 72, textAlign: 'right' }]}>{r.reading_count ?? '—'}</Text>
              <Text style={[styles.cellNum, { color: colors.text, width: 52, textAlign: 'right' }]}>{r.total_minutes ?? '—'}</Text>
              <Text style={[styles.cellBold,{ color: colors.text, width: 80, textAlign: 'right' }]}>{fmt$(r.projected_amount)}</Text>
              <View style={{ width: 85 }}>
                <StatusPill tone={STATUS_TONE[r.status] ?? 'muted'}>{r.status}</StatusPill>
              </View>
              <View style={{ width: 90, alignItems: 'flex-end', gap: 4 }}>
                {r.status === 'pending' && (
                  <Pressable onPress={() => onStatusChange(r.id, 'reviewed')} style={[styles.miniBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.miniBtnText, { color: colors.primary }]}>Review</Text>
                  </Pressable>
                )}
                {r.status === 'reviewed' && (
                  <Pressable onPress={() => onStatusChange(r.id, 'submitted')} style={[styles.miniBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.miniBtnText, { color: colors.success }]}>Submit</Text>
                  </Pressable>
                )}
                {r.status === 'submitted' && isSuperAdmin && (
                  <Pressable onPress={() => onStatusChange(r.id, 'paid')} style={[styles.miniBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.miniBtnText, { color: colors.success }]}>Paid</Text>
                  </Pressable>
                )}
                {isSuperAdmin && r.status !== 'pending' && r.status !== 'voided' && (
                  <Pressable onPress={() => onStatusChange(r.id, 'pending')} style={[styles.miniBtn, { borderColor: colors.warning }]}>
                    <Text style={[styles.miniBtnText, { color: colors.warning }]}>↩ Undo</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ChartCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: REVENUE
// ═══════════════════════════════════════════════════════════════════════════

function RevenueTab({ session, colors, isSuperAdmin }: {
  session: any; colors: ReturnType<typeof useTheme>; isSuperAdmin: boolean;
}) {
  const [data, setData]     = useState<RevenueBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [year, setYear]     = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError('');
    try {
      const result = await api.getBillingRevenue(session.token, year);
      setData(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load revenue data.');
    } finally { setLoading(false); }
  }, [session, year]);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Year picker */}
      <Card>
        <View style={[styles.filterRow, { alignItems: 'center' }]}>
          <Text style={[styles.filterLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Year</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[new Date().getFullYear() - 1, new Date().getFullYear()].map(y => (
              <Pressable
                key={y}
                onPress={() => setYear(y)}
                style={[
                  styles.yearBtn,
                  { borderColor: year === y ? colors.primary : colors.border,
                    backgroundColor: year === y ? colors.primary : colors.surface },
                ]}>
                <Text style={{ color: year === y ? '#fff' : colors.text, fontSize: 13, fontWeight: '600' }}>{y}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={load} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
            <RefreshCw size={12} color="#fff" />
            <Text style={styles.actionBtnText}>Refresh</Text>
          </Pressable>
        </View>
      </Card>

      {error ? (
        <Card><Text style={{ color: colors.critical, fontSize: 13 }}>{error}</Text></Card>
      ) : loading || !data ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <>
          {/* Summary KPIs */}
          <View style={styles.kpiRow}>
            <KpiCard label="Projected Revenue" icon={TrendingUp} tone="primary"
              value={fmtK(data.totalProjected)} sub={`${year} total`} />
            <KpiCard label="Submitted"          icon={CheckCircle2} tone="success"
              value={fmtK(data.totalSubmitted)} sub="Sent to payer" />
            <KpiCard label="Paid / Collected"   icon={DollarSign}  tone="info"
              value={fmtK(data.totalPaid)} sub="Received" />
            <KpiCard label="Pending Records"    icon={Clock}       tone="warning"
              value={String(data.pending)} sub="Need review" />
          </View>

          {/* By Program */}
          <ChartCard title="Revenue by Program" subtitle="Projected amounts">
            {data.byProgram.map((row, i) => {
              const pct = data.totalProjected > 0 ? (row.amount / data.totalProjected) * 100 : 0;
              return (
                <View key={row.program} style={i > 0 ? styles.breakdownRow : undefined}>
                  <View style={styles.breakdownLabelRow}>
                    <Text style={[styles.breakdownLabel, { color: colors.text }]}>{row.program}</Text>
                    <Text style={[styles.breakdownVal, { color: colors.text }]}>
                      {fmtK(row.amount)} · {row.count} records
                    </Text>
                  </View>
                  <ProgressBar value={pct} color={colors.primary} />
                </View>
              );
            })}
            {data.byProgram.length === 0 && <EmptyNote colors={colors} text="No revenue data yet." />}
          </ChartCard>

          {/* By CPT Code */}
          <ChartCard title="Revenue by CPT Code" subtitle="Top billing codes">
            <View style={[styles.tableHead, { backgroundColor: colors.surface }]}>
              {['CPT Code','Records','Units','Projected'].map((h, i) => (
                <Text key={h} style={[styles.th, { color: colors.textSecondary, flex: i === 0 ? 1.5 : 1, textAlign: i >= 2 ? 'right' : 'left' }]}>
                  {h}
                </Text>
              ))}
            </View>
            {data.byCpt.slice(0, 12).map((row, i) => (
              <View key={row.cpt_code}
                style={[styles.tableRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.cellBold, { color: colors.primary, flex: 1.5 }]}>{row.cpt_code}</Text>
                <Text style={[styles.cell, { color: colors.text, flex: 1 }]}>{row.count}</Text>
                <Text style={[styles.cellNum, { color: colors.text, flex: 1, textAlign: 'right' }]}>{row.units}</Text>
                <Text style={[styles.cellBold, { color: colors.text, flex: 1, textAlign: 'right' }]}>{fmtK(row.amount)}</Text>
              </View>
            ))}
            {data.byCpt.length === 0 && <EmptyNote colors={colors} text="No CPT data yet." />}
          </ChartCard>

          {/* By Insurance */}
          <ChartCard title="Revenue by Insurance" subtitle="Payer breakdown">
            {data.byInsurance.map((row, i) => {
              const pct = data.totalProjected > 0 ? (row.amount / data.totalProjected) * 100 : 0;
              return (
                <View key={row.insurance_type} style={i > 0 ? styles.breakdownRow : undefined}>
                  <View style={styles.breakdownLabelRow}>
                    <Text style={[styles.breakdownLabel, { color: colors.text }]}>{row.insurance_type}</Text>
                    <Text style={[styles.breakdownVal, { color: colors.text }]}>{fmtK(row.amount)}</Text>
                  </View>
                  <ProgressBar value={pct} color={colors.info ?? colors.primary} />
                </View>
              );
            })}
            {data.byInsurance.length === 0 && <EmptyNote colors={colors} text="No insurance data yet." />}
          </ChartCard>

          {/* By Month */}
          <ChartCard title="Monthly Trend" subtitle={String(year)}>
            <View style={[styles.tableHead, { backgroundColor: colors.surface }]}>
              {['Month','Records','Projected'].map((h, i) => (
                <Text key={h} style={[styles.th, { color: colors.textSecondary, flex: i === 0 ? 1.5 : 1, textAlign: i === 2 ? 'right' : 'left' }]}>{h}</Text>
              ))}
            </View>
            {data.byMonth.map((row, i) => (
              <View key={row.month}
                style={[styles.tableRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.cell, { color: colors.text, flex: 1.5 }]}>{row.month}</Text>
                <Text style={[styles.cell, { color: colors.text, flex: 1 }]}>{row.count}</Text>
                <Text style={[styles.cellBold, { color: colors.text, flex: 1, textAlign: 'right' }]}>{fmtK(row.amount)}</Text>
              </View>
            ))}
            {data.byMonth.length === 0 && <EmptyNote colors={colors} text="No monthly data yet." />}
          </ChartCard>

          {/* By Clinic (super_admin only) */}
          {isSuperAdmin && data.byClinic.length > 0 && (
            <ChartCard title="Revenue by Clinic" subtitle="All clinics">
              <View style={[styles.tableHead, { backgroundColor: colors.surface }]}>
                {['Clinic','Records','Projected'].map((h, i) => (
                  <Text key={h} style={[styles.th, { color: colors.textSecondary, flex: i === 0 ? 2.5 : 1, textAlign: i === 2 ? 'right' : 'left' }]}>{h}</Text>
                ))}
              </View>
              {data.byClinic.map((row, i) => (
                <View key={row.clinic_id}
                  style={[styles.tableRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <Text style={[styles.cell, { color: colors.text, flex: 2.5 }]} numberOfLines={1}>{row.clinic_name}</Text>
                  <Text style={[styles.cell, { color: colors.text, flex: 1 }]}>{row.count}</Text>
                  <Text style={[styles.cellBold, { color: colors.text, flex: 1, textAlign: 'right' }]}>{fmtK(row.amount)}</Text>
                </View>
              ))}
            </ChartCard>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: ADMIN (super_admin only)
// ═══════════════════════════════════════════════════════════════════════════

type AdminSub = 'rules' | 'fees' | 'offsets';

function AdminTab({ session, colors }: { session: any; colors: ReturnType<typeof useTheme> }) {
  const [sub, setSub] = useState<AdminSub>('rules');

  const subs: { key: AdminSub; label: string }[] = [
    { key: 'rules',   label: 'Billing Rules' },
    { key: 'fees',    label: 'Fee Schedules' },
    { key: 'offsets', label: 'DOS Offsets' },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tab bar */}
      <View style={[styles.subTabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {subs.map(({ key, label }) => {
          const active = sub === key;
          return (
            <Pressable
              key={key}
              onPress={() => setSub(key)}
              style={[styles.subTabBtn, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}>
              <Text style={[styles.subTabLabel, { color: active ? colors.primary : colors.textSecondary }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {sub === 'rules'   && <BillingRulesAdmin   session={session} colors={colors} />}
      {sub === 'fees'    && <FeeSchedulesAdmin    session={session} colors={colors} />}
      {sub === 'offsets' && <DosOffsetsAdmin      session={session} colors={colors} />}
    </View>
  );
}

// ── Billing Rules Admin ────────────────────────────────────────────────────

function BillingRulesAdmin({ session, colors }: { session: any; colors: ReturnType<typeof useTheme> }) {
  const [rules, setRules]     = useState<BillingRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError('');
    try {
      const { rules: r } = await api.getBillingRules(session.token);
      setRules(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load billing rules.');
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function toggleRule(id: string, active: boolean) {
    if (!session) return;
    setToggling(id);
    try {
      const { rule } = await api.updateBillingRule(session.token, id, { is_active: active });
      setRules(prev => prev.map(r => r.id === id ? rule : r));
    } catch { } finally { setToggling(null); }
  }

  async function deleteRule(id: string) {
    if (!session) return;
    try {
      await api.deleteBillingRule(session.token, id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch { }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (error)   return <View style={styles.content}><Card><Text style={{ color: colors.critical }}>{error}</Text></Card></View>;

  const grouped = rules.reduce((acc, r) => {
    const key = r.rule_category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, BillingRuleItem[]>);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {Object.entries(grouped).map(([category, categoryRules]) => (
        <ChartCard key={category} title={`${category} Rules`} subtitle={`${categoryRules.length} rules`}>
          {categoryRules.map((rule, i) => (
            <View
              key={rule.id}
              style={[
                styles.ruleRow,
                i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                !rule.is_active && { opacity: 0.45 },
              ]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ruleName, { color: colors.text }]}>{rule.rule_name}</Text>
                <Text style={[styles.ruleSub, { color: colors.textSecondary }]}>
                  {rule.insurance_type} ·{' '}
                  {rule.min_readings != null ? `${rule.min_readings}+` : ''}
                  {rule.max_readings != null ? `–${rule.max_readings}` : ''} readings ·{' '}
                  {rule.trigger_minutes != null ? `${rule.trigger_minutes}+ min` : 'no time req'} ·{' '}
                  CPT: {rule.cpt_codes.join(', ')} (×{rule.units})
                  {rule.is_one_time ? ' · ONE-TIME' : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Pressable
                  onPress={() => toggleRule(rule.id, !rule.is_active)}
                  disabled={toggling === rule.id}
                  style={[
                    styles.miniBtn,
                    { borderColor: rule.is_active ? colors.success : colors.border },
                  ]}>
                  <Text style={[styles.miniBtnText, { color: rule.is_active ? colors.success : colors.textSecondary }]}>
                    {rule.is_active ? 'Active' : 'Off'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => deleteRule(rule.id)}>
                  <Trash2 size={14} color={colors.critical} />
                </Pressable>
              </View>
            </View>
          ))}
        </ChartCard>
      ))}
    </ScrollView>
  );
}

// ── Fee Schedules Admin ────────────────────────────────────────────────────

function FeeSchedulesAdmin({ session, colors }: { session: any; colors: ReturnType<typeof useTheme> }) {
  const [schedules, setSchedules] = useState<FeeScheduleItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [editing, setEditing]     = useState<FeeScheduleItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { schedules: s } = await api.getFeeSchedules(session.token);
      setSchedules(s);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load fee schedules.');
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function saveEdit() {
    if (!session || !editing) return;
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount < 0) return;
    setSaving(true);
    try {
      const { schedule } = await api.upsertFeeSchedule(session.token, {
        payer: editing.payer,
        cpt_code: editing.cpt_code,
        amount,
        effective_date: new Date().toISOString().split('T')[0],
        end_date: null,
      });
      setSchedules(prev => {
        const idx = prev.findIndex(s => s.id === editing.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = schedule; return next; }
        return [schedule, ...prev];
      });
      setEditing(null);
    } catch { } finally { setSaving(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (error)   return <View style={styles.content}><Card><Text style={{ color: colors.critical }}>{error}</Text></Card></View>;

  const payers = [...new Set(schedules.map(s => s.payer))];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Edit modal */}
      <Modal visible={!!editing} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Edit Rate — {editing?.payer} / {editing?.cpt_code}
            </Text>
            <TextInput
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              placeholder="Amount (e.g. 50.18)"
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholderTextColor={colors.textSecondary}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable onPress={() => setEditing(null)} style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveEdit}
                disabled={saving}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {payers.map(payer => {
        const rows = schedules.filter(s => s.payer === payer);
        return (
          <ChartCard key={payer} title={payer} subtitle={`${rows.length} CPT codes`}>
            <View style={[styles.tableHead, { backgroundColor: colors.surface }]}>
              {['CPT Code','Rate','Effective',''].map((h, i) => (
                <Text key={h} style={[styles.th, { color: colors.textSecondary, flex: i === 3 ? 0.5 : 1, textAlign: i === 1 ? 'right' : 'left' }]}>{h}</Text>
              ))}
            </View>
            {rows.map((s, i) => (
              <View key={s.id}
                style={[styles.tableRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.cellBold, { color: colors.primary, flex: 1 }]}>{s.cpt_code}</Text>
                <Text style={[styles.cellBold, { color: colors.text, flex: 1, textAlign: 'right' }]}>{fmt$(s.amount)}</Text>
                <Text style={[styles.cell, { color: colors.textSecondary, flex: 1 }]}>{s.effective_date}</Text>
                <Pressable
                  style={{ flex: 0.5, alignItems: 'flex-end' }}
                  onPress={() => { setEditing(s); setEditAmount(String(s.amount)); }}>
                  <Text style={{ color: colors.primary, fontSize: 12 }}>Edit</Text>
                </Pressable>
              </View>
            ))}
          </ChartCard>
        );
      })}
    </ScrollView>
  );
}

// ── DOS Offsets Admin ──────────────────────────────────────────────────────

function DosOffsetsAdmin({ session, colors }: { session: any; colors: ReturnType<typeof useTheme> }) {
  const [offsets, setOffsets]   = useState<DosOffsetItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [editing, setEditing]   = useState<DosOffsetItem | null>(null);
  const [editDays, setEditDays] = useState('');
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { offsets: o } = await api.getDosOffsets(session.token);
      setOffsets(o);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load DOS offsets.');
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function saveEdit() {
    if (!session || !editing) return;
    setSaving(true);
    try {
      const days = editDays ? parseInt(editDays) : null;
      const { offset } = await api.updateDosOffset(session.token, editing.id, { offset_days: days });
      setOffsets(prev => prev.map(o => o.id === editing.id ? offset : o));
      setEditing(null);
    } catch { } finally { setSaving(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (error)   return <View style={styles.content}><Card><Text style={{ color: colors.critical }}>{error}</Text></Card></View>;

  const programs = [...new Set(offsets.map(o => o.program))];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Edit modal */}
      <Modal visible={!!editing} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              DOS Offset — {editing?.program} / {editing?.cpt_code}
            </Text>
            <Text style={[{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }]}>
              Type: {editing?.offset_type === 'shipment_date' ? 'Shipment date (not editable)' : 'Cycle start + N days'}
            </Text>
            {editing?.offset_type !== 'shipment_date' && (
              <TextInput
                value={editDays}
                onChangeText={setEditDays}
                keyboardType="number-pad"
                placeholder="Days after cycle start (e.g. 26)"
                style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                placeholderTextColor={colors.textSecondary}
              />
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable onPress={() => setEditing(null)} style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              {editing?.offset_type !== 'shipment_date' && (
                <Pressable onPress={saveEdit} disabled={saving} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {programs.map(program => {
        const rows = offsets.filter(o => o.program === program);
        return (
          <ChartCard key={program} title={`${program} DOS Offsets`} subtitle={`${rows.length} codes`}>
            <View style={[styles.tableHead, { backgroundColor: colors.surface }]}>
              {['CPT','Type','Offset',''].map((h, i) => (
                <Text key={h} style={[styles.th, { color: colors.textSecondary, flex: i === 3 ? 0.5 : 1 }]}>{h}</Text>
              ))}
            </View>
            {rows.map((o, i) => (
              <View key={o.id}
                style={[styles.tableRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.cellBold, { color: colors.primary, flex: 1 }]}>{o.cpt_code}</Text>
                <Text style={[styles.cell, { color: colors.textSecondary, flex: 1 }]}>
                  {o.offset_type === 'shipment_date' ? 'Shipment date' : 'Cycle start'}
                </Text>
                <Text style={[styles.cell, { color: colors.text, flex: 1 }]}>
                  {o.offset_type === 'shipment_date' ? '—' : `+${o.offset_days ?? 0} days`}
                </Text>
                <Pressable
                  style={{ flex: 0.5, alignItems: 'flex-end' }}
                  onPress={() => { setEditing(o); setEditDays(String(o.offset_days ?? '')); }}>
                  <Text style={{ color: colors.primary, fontSize: 12 }}>Edit</Text>
                </Pressable>
              </View>
            ))}
          </ChartCard>
        );
      })}
    </ScrollView>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function FilterSelect({
  value, onChange, options, colors,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  colors: ReturnType<typeof useTheme>;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value) ?? options[0];
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.filterInput, { borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
        <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{current.label}</Text>
        <ChevronDown size={12} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={[styles.pickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {options.map(opt => (
              <Pressable
                key={opt.value}
                onPress={() => { onChange(opt.value); setOpen(false); }}
                style={[styles.pickerItem, opt.value === value && { backgroundColor: colors.surface }]}>
                <Text style={{ color: opt.value === value ? colors.primary : colors.text, fontSize: 14, fontWeight: opt.value === value ? '700' : '400' }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function EmptyNote({ colors, text }: { colors: ReturnType<typeof useTheme>; text: string }) {
  return (
    <View style={[styles.emptyBox, { marginVertical: 8 }]}>
      <AlertCircle size={16} color={colors.textSecondary} />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content:     { padding: 16, paddingBottom: 48, gap: 14 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  // Tab bar
  tabBar:      { paddingHorizontal: 16, paddingTop: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  tabRow:      { flexDirection: 'row', gap: 0, marginTop: 8 },
  tabBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 14 },
  tabLabel:    { fontSize: 13, fontWeight: '600' },

  // Sub-tab bar (admin)
  subTabBar:   { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  subTabBtn:   { paddingVertical: 10, paddingHorizontal: 14 },
  subTabLabel: { fontSize: 13, fontWeight: '600' },

  // KPI row
  kpiRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Filters
  filterRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterGroup: { gap: 4 },
  filterLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  filterInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, minWidth: 100 },
  yearBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },

  // Action buttons
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Table
  tableHead:   { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  tableRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 10, gap: 4 },
  th:          { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  cell:        { fontSize: 12 },
  cellPrimary: { fontSize: 12, fontWeight: '600' },
  cellSub:     { fontSize: 10.5, marginTop: 1 },
  cellBold:    { fontSize: 12, fontWeight: '700' },
  cellNum:     { fontSize: 12 },

  // Breakdown rows
  breakdownRow:     { marginTop: 12 },
  breakdownLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  breakdownLabel:   { fontSize: 13, fontWeight: '600' },
  breakdownVal:     { fontSize: 13 },

  // Billing rules admin
  ruleRow:  { paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleName: { fontSize: 12.5, fontWeight: '600', marginBottom: 2 },
  ruleSub:  { fontSize: 11, lineHeight: 15 },

  // Picker (Modal-based select)
  pickerCard:   { width: 220, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  pickerItem:   { paddingHorizontal: 16, paddingVertical: 13 },

  // Mini buttons
  miniBtn:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  miniBtnText: { fontSize: 11, fontWeight: '600' },

  // Empty state
  emptyBox:   { alignItems: 'center', gap: 8, paddingVertical: 20 },
  emptyText:  { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard:    { width: '100%', maxWidth: 400, borderRadius: 16, borderWidth: 1, padding: 20 },
  modalTitle:   { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  modalInput:   { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  modalBtn:     { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
});
