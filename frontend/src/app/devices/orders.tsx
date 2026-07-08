import {
  CheckCircle2, Clock, Package, RefreshCw, Truck,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Linking, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { api, type UnifiedOrder } from '@/lib/api';
import type { Tone } from '@/components/ui/status-pill';

// ── Helpers ────────────────────────────────────────────────────────────────

const ORDER_STATUS_TONE: Record<string, Tone> = {
  Draft:       'muted',
  Requested:   'muted',
  Pending:     'warning',
  Created:     'info',
  'On Hold':   'warning',
  Processing:  'info',
  Shipped:     'info',
  Dispatched:  'info',
  Updated:     'info',
  Delivered:   'primary',
  Confirmed:   'primary',
  Active:      'success',
  Activated:   'success',
  Returned:    'warning',
  Rerouted:    'warning',
  Cancelled:   'critical',
  Unknown:     'muted',
};

function orderTone(status: string): Tone {
  return ORDER_STATUS_TONE[status] ?? 'muted';
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffD  = Math.round(diffMs / 86_400_000);
  if (diffD === 0) return 'Today';
  if (diffD === 1) return 'Yesterday';
  if (diffD < 30)  return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

// ── Pipeline bar ───────────────────────────────────────────────────────────

const PIPELINE_STAGES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Activated'];

function PipelineBar({ orders }: { orders: UnifiedOrder[] }) {
  const colors = useTheme();
  const stageCounts = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: orders.filter((o) => o.status === stage).length,
  }));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.pipeline}>
        {stageCounts.map(({ stage, count }, i) => (
          <View key={stage} style={styles.pipelineItem}>
            <View style={[
              styles.pipelineNode,
              { backgroundColor: count > 0 ? colors.primary + '18' : colors.muted, borderColor: count > 0 ? colors.primary + '40' : colors.border },
            ]}>
              <Text style={[styles.pipelineCount, { color: count > 0 ? colors.primary : colors.textSecondary }]}>
                {count}
              </Text>
            </View>
            <Text style={[styles.pipelineLabel, { color: colors.textSecondary }]}>{stage}</Text>
            {i < stageCounts.length - 1 && (
              <Text style={[styles.pipelineArrow, { color: colors.border }]}>→</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Filter select ─────────────────────────────────────────────────────────

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string; value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  const colors = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? label;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.filterBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.filterBtnText, { color: value ? colors.text : colors.textSecondary }]} numberOfLines={1}>
          {current}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 10 }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={[styles.pickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[{ label, value: '' }, ...options].map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => { onChange(opt.value); setOpen(false); }}
                style={[
                  styles.pickerOpt,
                  opt.value === value && { backgroundColor: colors.primary + '14' },
                ]}>
                <Text style={[styles.pickerOptText, { color: opt.value === value ? colors.primary : colors.text }]}>
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

// ── Orders table ───────────────────────────────────────────────────────────

const ORDER_FIXED_W = 100 + 110 + 80 + 90 + 90; // order#+source+tracking+status+date

function OrdersTable({ orders }: { orders: UnifiedOrder[] }) {
  const colors = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = screenWidth - 32;
  const devicesColW = Math.max(160, availableWidth - ORDER_FIXED_W);
  const tableWidth  = Math.max(devicesColW + ORDER_FIXED_W, availableWidth);

  if (orders.length === 0) {
    return (
      <View style={[styles.emptyBox, { borderColor: colors.border }]}>
        <Package size={28} color={colors.textSecondary} strokeWidth={1.5} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No orders match filters</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width: tableWidth, minWidth: tableWidth }}>
        {/* Header */}
        <View style={[styles.tableHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.th, { width: 100, color: colors.textSecondary }]}>ORDER #</Text>
          <Text style={[styles.th, { width: devicesColW, color: colors.textSecondary }]}>DEVICES / RECIPIENT</Text>
          <Text style={[styles.th, { width: 110, color: colors.textSecondary }]}>SOURCE</Text>
          <Text style={[styles.th, { width: 80,  color: colors.textSecondary }]}>TRACKING</Text>
          <Text style={[styles.th, { width: 90,  color: colors.textSecondary }]}>STATUS</Text>
          <Text style={[styles.th, { width: 90,  color: colors.textSecondary }]}>DATE</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
          {orders.map((o, i) => (
            <View
              key={o.id}
              style={[
                styles.tableRow,
                { borderBottomColor: colors.border },
                i % 2 === 0 && { backgroundColor: colors.background },
              ]}>
              {/* Order number */}
              <View style={{ width: 100, paddingRight: 6 }}>
                <Text style={[styles.orderNum, { color: colors.text }]} numberOfLines={1}>
                  {o.orderNumber}
                </Text>
                {o.fulfilled && (
                  <View style={styles.fulfilledRow}>
                    <CheckCircle2 size={9} color={colors.success} />
                    <Text style={[styles.fulfilledText, { color: colors.success }]}>Fulfilled</Text>
                  </View>
                )}
              </View>
              {/* Devices + recipient */}
              <View style={{ width: devicesColW, paddingRight: 8 }}>
                <Text style={[styles.devicesList, { color: colors.text }]} numberOfLines={2}>
                  {o.devices.length > 0 ? o.devices.join(', ') : '—'}
                </Text>
                {(o.patientName || o.clinicName) && (
                  <Text style={[styles.recipientSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {[o.patientName, o.clinicName].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              {/* Source */}
              <View style={{ width: 110, justifyContent: 'center' }}>
                <View style={[
                  styles.sourcePill,
                  { backgroundColor: o.source === 'Tenovi' ? colors.info + '18' : colors.primary + '18' },
                ]}>
                  <Text style={[styles.sourcePillText, { color: o.source === 'Tenovi' ? colors.info : colors.primary }]}>
                    {o.source}
                  </Text>
                </View>
              </View>
              {/* Tracking */}
              <View style={{ width: 80, justifyContent: 'center' }}>
                {o.trackingLink ? (
                  <Pressable onPress={() => Linking.openURL(o.trackingLink!)}>
                    <Text style={[styles.trackingLink, { color: colors.primary }]} numberOfLines={1}>
                      Track ↗
                    </Text>
                  </Pressable>
                ) : o.tracking ? (
                  <Text style={[styles.tracking, { color: colors.textSecondary }]} numberOfLines={1}>
                    {o.tracking.length > 12 ? o.tracking.slice(-10) : o.tracking}
                  </Text>
                ) : (
                  <Text style={[styles.tracking, { color: colors.textSecondary }]}>—</Text>
                )}
                {o.carrier && (
                  <Text style={[styles.carrier, { color: colors.textSecondary }]} numberOfLines={1}>
                    {o.carrier}
                  </Text>
                )}
              </View>
              {/* Status */}
              <View style={{ width: 90, justifyContent: 'center' }}>
                <StatusPill tone={orderTone(o.status)}>{o.status}</StatusPill>
              </View>
              {/* Date */}
              <View style={{ width: 90, justifyContent: 'center' }}>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                  {fmtDate(o.createdAt)}
                </Text>
                {o.shippedOn && (
                  <Text style={[styles.shippedText, { color: colors.textSecondary }]}>
                    Shipped {fmtDate(o.shippedOn)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

type SourceFilter = '' | 'SmartMeter' | 'Tenovi';
type StatusFilter = '' | 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Activated' | 'Returned' | 'Cancelled';

const SOURCE_OPTIONS = [
  { label: 'SmartMeter', value: 'SmartMeter' },
  { label: 'Tenovi',     value: 'Tenovi' },
];
const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'Pending',     value: 'Pending' },
  { label: 'Processing',  value: 'Processing' },
  { label: 'Shipped',     value: 'Shipped' },
  { label: 'Delivered',   value: 'Delivered' },
  { label: 'Activated',   value: 'Activated' },
  { label: 'Returned',    value: 'Returned' },
  { label: 'Cancelled',   value: 'Cancelled' },
];

export default function DeviceOrdersScreen() {
  const colors = useTheme();
  const { session } = useAuth();

  const [orders, setOrders]     = useState<UnifiedOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch]   = useState('');
  const [source, setSource]   = useState<SourceFilter>('');
  const [status, setStatus]   = useState<StatusFilter>('');

  const load = useCallback(async (showSpinner = true) => {
    if (!session?.token) return;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const { orders: data } = await api.listDeviceOrders(session.token);
      setOrders(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.token]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((o) => {
      if (source && o.source !== source) return false;
      if (status && o.status !== status) return false;
      if (q &&
          !o.orderNumber.toLowerCase().includes(q) &&
          !(o.patientName ?? '').toLowerCase().includes(q) &&
          !(o.clinicName ?? '').toLowerCase().includes(q) &&
          !o.devices.join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, search, source, status]);

  // KPI counts
  const pending    = orders.filter((o) => ['Pending', 'Draft', 'Requested', 'Created', 'Processing', 'On Hold'].includes(o.status)).length;
  const inTransit  = orders.filter((o) => ['Shipped', 'Dispatched', 'Updated'].includes(o.status)).length;
  const delivered  = orders.filter((o) => ['Delivered', 'Confirmed'].includes(o.status)).length;
  const returned   = orders.filter((o) => ['Returned', 'Rerouted', 'Cancelled'].includes(o.status)).length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow="Fulfillment"
          title="Device Orders"
          description="End-to-end pipeline: SmartMeter & Tenovi orders, shipping, and delivery."
        />

        {/* KPI cards */}
        <View style={styles.kpiRow}>
          <KpiCard label="Pending / Processing" value={pending}   icon={Clock}        tone="warning" />
          <KpiCard label="In Transit"           value={inTransit} icon={Truck}        tone="info"    />
          <KpiCard label="Delivered"            value={delivered} icon={Package}      tone="primary" />
          <KpiCard label="Returned / Cancelled" value={returned}  icon={RefreshCw}    tone="critical" />
        </View>

        {/* Pipeline visualization */}
        {!loading && orders.length > 0 && (
          <Card style={styles.pipelineCard}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PIPELINE</Text>
            <PipelineBar orders={orders} />
          </Card>
        )}

        {/* Filters */}
        <Card style={styles.filterCard}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Search order #, patient, clinic, device…"
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.filterRow}>
            <FilterSelect
              label="All Sources"
              value={source}
              options={SOURCE_OPTIONS}
              onChange={(v) => setSource(v as SourceFilter)}
            />
            <FilterSelect
              label="All Statuses"
              value={status}
              options={STATUS_OPTIONS as { label: string; value: string }[]}
              onChange={(v) => setStatus(v as StatusFilter)}
            />
            <Pressable
              onPress={() => { setSearch(''); setSource(''); setStatus(''); }}
              style={[styles.clearBtn, { borderColor: colors.border }]}>
              <Text style={[styles.clearBtnText, { color: colors.textSecondary }]}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => { setRefreshing(true); load(false); }}
              style={[styles.refreshBtn, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '30' }]}>
              <RefreshCw size={13} color={colors.primary} />
              <Text style={[styles.refreshBtnText, { color: colors.primary }]}>Refresh</Text>
            </Pressable>
          </View>
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            Showing {filtered.length} of {orders.length} orders (last 30 days)
          </Text>
        </Card>

        {/* Table */}
        <Card style={styles.tableCard}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading orders from SmartMeter & Tenovi…
              </Text>
              <Text style={[styles.loadingHint, { color: colors.textSecondary }]}>
                First load may take up to 20s
              </Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={[styles.errorText, { color: colors.critical }]}>{error}</Text>
              <Pressable onPress={() => load()} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <OrdersTable orders={filtered} />
          )}
        </Card>

        {/* Source legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>SmartMeter — iBP, iGlucose cellular devices</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>Tenovi — BPM, Scale, Pillbox, Gateway bulk orders</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1 },
  scroll:   { padding: 16, gap: 16, paddingBottom: 40 },
  kpiRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterCard:  { gap: 10 },
  pipelineCard: { gap: 10 },
  tableCard:   { overflow: 'hidden' },
  center:   { alignItems: 'center', paddingVertical: 40, gap: 12 },
  sectionLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },

  searchInput: {
    height: 38, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 13,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, minWidth: 100, maxWidth: 160,
  },
  filterBtnText: { fontSize: 12, fontWeight: '600', flex: 1 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  clearBtnText: { fontSize: 12, fontWeight: '600' },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
  },
  refreshBtnText: { fontSize: 12, fontWeight: '600' },
  countLabel: { fontSize: 11.5 },

  // Pipeline
  pipeline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pipelineItem: { alignItems: 'center', gap: 4, flexDirection: 'row' },
  pipelineNode: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  pipelineCount: { fontSize: 16, fontWeight: '800' },
  pipelineLabel: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  pipelineArrow: { fontSize: 16, marginHorizontal: 6 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  pickerCard: {
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 6, minWidth: 180, maxWidth: 280,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  pickerOpt: { paddingHorizontal: 16, paddingVertical: 12 },
  pickerOptText: { fontSize: 14, fontWeight: '500' },

  // Table
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  th: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  orderNum: { fontSize: 12.5, fontWeight: '700', fontFamily: 'monospace' },
  fulfilledRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  fulfilledText: { fontSize: 9.5, fontWeight: '600' },
  devicesList: { fontSize: 12, fontWeight: '500' },
  recipientSub: { fontSize: 11, marginTop: 2 },
  sourcePill: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sourcePillText: { fontSize: 11, fontWeight: '700' },
  trackingLink: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  tracking: { fontSize: 11.5, fontFamily: 'monospace' },
  carrier: { fontSize: 10.5, marginTop: 2 },
  dateText: { fontSize: 12 },
  shippedText: { fontSize: 10.5, marginTop: 2 },

  emptyBox: {
    alignItems: 'center', paddingVertical: 40, gap: 10,
    borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
  },
  emptyText:   { fontSize: 13 },
  loadingText: { fontSize: 13, textAlign: 'center' },
  loadingHint: { fontSize: 11, textAlign: 'center' },
  errorText:   { fontSize: 13, textAlign: 'center' },
  retryBtn:    { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText:{ color: '#fff', fontWeight: '700', fontSize: 13 },

  legendRow: { gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
});
