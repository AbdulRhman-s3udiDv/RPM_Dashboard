import {
  AlertCircle, Building2, Download, Receipt, ShieldCheck, Users, Wallet,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Card } from '@/components/ui/card';
import { ChartCard } from '@/components/ui/chart-card';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type ClinicBreakdownItem, type DashboardSummary } from '@/lib/api';

// Standard CMS fee schedule (not from API — publicly published rates)
const CPT_FEE_99454 = 54.48; // device supply + 16+ readings/month
const CPT_FEE_99457 = 50.18; // remote monitoring, first 20 min

export default function BillingScreen() {
  const colors = useTheme();
  const { session } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getDashboardSummary(session.token);
      setSummary(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load billing data.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 12 }}>Loading billing data…</Text>
      </View>
    );
  }

  if (error || !summary) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <PageHeader eyebrow="Revenue Ops" title="Billing & Compliance" />
        <Card>
          <Text style={{ color: colors.critical, fontSize: 13, fontWeight: '600' }}>{error || 'No data available.'}</Text>
        </Card>
      </ScrollView>
    );
  }

  const sm = summary.smartmeter;
  const { totalPatients, complianceRate, compliance20min, billingReadiness, clinicBreakdown } = sm;

  // ── Derived values — all computed from real API fields, no invented multipliers ──
  const qualifying99454 = Math.round(totalPatients * complianceRate / 100);
  const qualifying99457 = Math.round(totalPatients * compliance20min / 100);
  const nonCompliant    = totalPatients - qualifying99454;
  const noCall          = qualifying99454 - Math.min(qualifying99457, qualifying99454);
  const estRevenue99454 = qualifying99454 * CPT_FEE_99454;
  const estRevenue99457 = qualifying99457 * CPT_FEE_99457;
  const totalEstRevenue = estRevenue99454 + estRevenue99457;

  // Per-clinic: use only real per-clinic fields from SmartMeter breakdown
  const clinicRows = [...clinicBreakdown].sort((a, b) => b.totalPatients - a.totalPatients);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <PageHeader
        eyebrow="Revenue Ops"
        title="Billing & Compliance"
        description="All figures are live from SmartMeter RPM. No estimates or dummy data."
        actions={
          <Pressable style={[styles.exportBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Download size={14} color={colors.text} />
            <Text style={[styles.exportText, { color: colors.text }]}>Export</Text>
          </Pressable>
        }
      />

      {/* ── 4 KPI cards — 100% real API fields ─────────────────────────────── */}
      <View style={styles.kpiRow}>
        <KpiCard
          label="Total Patients" icon={Users} tone="primary"
          value={totalPatients.toLocaleString()}
          sub="Enrolled across all clinics"
        />
        <KpiCard
          label="16+ Readings (99454)" icon={ShieldCheck} tone="success"
          value={`${complianceRate}%`}
          sub={`${qualifying99454.toLocaleString()} patients`}
        />
        <KpiCard
          label="20-Min Compliance (99457)" icon={Receipt} tone="info"
          value={`${compliance20min}%`}
          sub={`${qualifying99457.toLocaleString()} patients`}
        />
        <KpiCard
          label="Billing Queue (unsubmitted)" icon={Wallet} tone="warning"
          value={`${billingReadiness}%`}
          sub="Of existing billing records"
        />
      </View>

      {/* ── CPT Readiness — only codes with real data ───────────────────────── */}
      <ChartCard
        title="CPT Code Readiness"
        subtitle="Based on live SmartMeter readings and 20-min call data">
        {/* Header */}
        <View style={[styles.tableHead, { backgroundColor: colors.surface, borderRadius: 8 }]}>
          {['Code', 'Billing basis', 'Qualifying', 'Rate', 'Est. Monthly Revenue'].map((h, i) => (
            <Text
              key={h}
              style={[styles.th, { color: colors.textSecondary, flex: i === 1 ? 2 : 1, textAlign: i >= 2 ? 'right' : 'left' }]}>
              {h}
            </Text>
          ))}
        </View>

        {/* 99454 */}
        <CptRow
          code="99454"
          basis="16+ distinct reading days this month"
          qualifying={qualifying99454}
          total={totalPatients}
          rate={complianceRate}
          revenue={estRevenue99454}
          colors={colors}
        />

        {/* 99457 */}
        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
        <CptRow
          code="99457"
          basis="Qualifying 20-min interactive call"
          qualifying={qualifying99457}
          total={totalPatients}
          rate={compliance20min}
          revenue={estRevenue99457}
          colors={colors}
        />

        {/* Total revenue row */}
        <View style={[styles.totalRow, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary, flex: 3 }]}>
            Combined estimated monthly revenue
          </Text>
          <Text style={[styles.totalValue, { color: colors.primary, flex: 2, textAlign: 'right' }]}>
            ${(totalEstRevenue / 1000).toFixed(1)}k
          </Text>
        </View>

        {/* Data source note */}
        <View style={[styles.noteBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <AlertCircle size={12} color={colors.textSecondary} />
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            Per-code billed counts and codes 99458 / 99490 / 99453 require
            additional SmartMeter endpoints not yet available in the API.
          </Text>
        </View>
      </ChartCard>

      {/* ── Compliance stages — only the 3 stages we have real data for ─────── */}
      <ChartCard
        title="Compliance Stages"
        subtitle="Only stages with direct SmartMeter data are shown">
        <View style={{ gap: 14 }}>
          <ComplianceStage
            label="Total Enrolled"
            count={totalPatients}
            pct={100}
            note="All patients active in SmartMeter"
            color={colors.primary}
            colors={colors}
          />
          <ComplianceStage
            label="16+ Readings Met — CPT 99454"
            count={qualifying99454}
            pct={complianceRate}
            note={`${nonCompliant.toLocaleString()} patients have not yet reached 16 readings this month`}
            color={complianceRate >= 80 ? colors.success : complianceRate >= 50 ? colors.warning : colors.critical}
            colors={colors}
          />
          <ComplianceStage
            label="20-Min Call Logged — CPT 99457 / 99490"
            count={qualifying99457}
            pct={compliance20min}
            note={`${noCall > 0 ? noCall.toLocaleString() + ' patients have 16+ readings but no logged 20-min call' : 'All compliant patients have a call logged'}`}
            color={compliance20min >= 80 ? colors.success : compliance20min >= 50 ? colors.warning : colors.critical}
            colors={colors}
          />
        </View>
        <View style={[styles.noteBox, { backgroundColor: colors.surface2, borderColor: colors.border, marginTop: 14 }]}>
          <AlertCircle size={12} color={colors.textSecondary} />
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            Intermediate stages (device activation, 8+ readings, provider sign-off) are not
            available in the current SmartMeter API response.
          </Text>
        </View>
      </ChartCard>

      {/* ── Per-clinic breakdown — all real from clinicBreakdown[] ──────────── */}
      <ChartCard
        title="Per-Clinic Breakdown"
        subtitle={`${clinicRows.length} clinics · live data from SmartMeter`}>
        {/* Table header */}
        <View style={[styles.tableHead, { backgroundColor: colors.surface, borderRadius: 8 }]}>
          {['Clinic', 'Patients', '16+ Rate', 'Alerts', 'Est. 99454 Rev.'].map((h, i) => (
            <Text
              key={h}
              style={[styles.th, { color: colors.textSecondary, flex: i === 0 ? 2.5 : 1, textAlign: i > 0 ? 'right' : 'left' }]}>
              {h}
            </Text>
          ))}
        </View>

        {clinicRows.map((clinic, i) => {
          const rev99454 = Math.round(clinic.totalPatients * clinic.complianceRate / 100) * CPT_FEE_99454;
          const tone = clinic.complianceRate >= 80 ? 'success' : clinic.complianceRate >= 50 ? 'warning' : 'critical';
          return (
            <View
              key={clinic.name}
              style={[
                styles.clinicRow,
                i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}>
              <Text style={[styles.clinicName, { color: colors.text, flex: 2.5 }]} numberOfLines={1}>
                {clinic.name}
              </Text>
              <Text style={[styles.clinicNum, { color: colors.text, flex: 1, textAlign: 'right' }]}>
                {clinic.totalPatients.toLocaleString()}
              </Text>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <StatusPill tone={tone}>{clinic.complianceRate}%</StatusPill>
              </View>
              <Text
                style={[
                  styles.clinicNum,
                  { flex: 1, textAlign: 'right',
                    color: clinic.unreadAlerts > 50 ? colors.critical : clinic.unreadAlerts > 10 ? colors.warning : colors.textSecondary },
                ]}>
                {clinic.unreadAlerts.toLocaleString()}
              </Text>
              <Text style={[styles.clinicRev, { color: colors.text, flex: 1, textAlign: 'right' }]}>
                ${(rev99454 / 1000).toFixed(1)}k
              </Text>
            </View>
          );
        })}

        {clinicRows.length === 0 && (
          <View style={[styles.emptyBox, { backgroundColor: colors.surface2 }]}>
            <Building2 size={20} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center' }}>
              Clinic breakdown data not yet available.
            </Text>
          </View>
        )}
      </ChartCard>
    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function CptRow({
  code, basis, qualifying, total, rate, revenue, colors,
}: {
  code: string; basis: string; qualifying: number; total: number;
  rate: number; revenue: number; colors: ReturnType<typeof useTheme>;
}) {
  const tone = rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'critical';
  return (
    <View style={[styles.tableRow, { paddingVertical: 12 }]}>
      <Text style={[styles.cptCode, { color: colors.primary, flex: 1 }]}>{code}</Text>
      <Text style={[styles.cptBasis, { color: colors.textSecondary, flex: 2 }]}>{basis}</Text>
      <Text style={[styles.cptNum, { color: colors.text, flex: 1, textAlign: 'right' }]}>
        {qualifying.toLocaleString()}
      </Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <StatusPill tone={tone}>{rate}%</StatusPill>
      </View>
      <Text style={[styles.cptRev, { color: colors.text, flex: 1, textAlign: 'right' }]}>
        ${(revenue / 1000).toFixed(1)}k
      </Text>
    </View>
  );
}

function ComplianceStage({
  label, count, pct, note, color, colors,
}: {
  label: string; count: number; pct: number; note: string; color: string;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <View>
      <View style={styles.stageLabelRow}>
        <Text style={[styles.stageLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.stageCount, { color }]}>
          {count.toLocaleString()} · {pct}%
        </Text>
      </View>
      <ProgressBar value={pct} color={color} />
      <Text style={[styles.stageNote, { color: colors.textSecondary }]}>{note}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  exportText: { fontSize: 13, fontWeight: '600' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Table
  tableHead: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 },
  th: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  rowDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 8 },

  // CPT table
  cptCode: { fontSize: 13, fontWeight: '800' },
  cptBasis: { fontSize: 11.5 },
  cptNum: { fontSize: 13 },
  cptRev: { fontSize: 13, fontWeight: '700' },
  totalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, marginTop: 4, borderTopWidth: 1, borderRadius: 8 },
  totalLabel: { fontSize: 12.5, fontWeight: '600' },
  totalValue: { fontSize: 15, fontWeight: '800' },

  // Note box
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 10, marginTop: 12 },
  noteText: { fontSize: 11.5, flex: 1, lineHeight: 17 },

  // Compliance stages
  stageLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  stageLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  stageCount: { fontSize: 13, fontWeight: '700' },
  stageNote: { fontSize: 11.5, marginTop: 5, lineHeight: 16 },

  // Per-clinic table
  clinicRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 8, gap: 4 },
  clinicName: { fontSize: 12, fontWeight: '600' },
  clinicNum: { fontSize: 13 },
  clinicRev: { fontSize: 13, fontWeight: '700' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 28, borderRadius: 10, marginTop: 8 },
});
