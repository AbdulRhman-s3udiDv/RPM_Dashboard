import {
  Activity, Cpu, RefreshCw, Signal, Wifi, WifiOff, Zap,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { api, type UnifiedDevice } from '@/lib/api';
import type { Tone } from '@/components/ui/status-pill';

// ── Status helpers ────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, Tone> = {
  connected:    'success',
  active:       'success',
  delivered:    'primary',
  disconnected: 'muted',
  inactive:     'muted',
  unknown:      'muted',
  shipped:      'info',
  in_transit:   'info',
  cancelled:    'critical',
  returned:     'warning',
};

function deviceTone(status: string): Tone {
  return STATUS_TONE[status.toLowerCase()] ?? 'muted';
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 1)   return `${Math.round(diffMs / 60000)}m ago`;
  if (diffH < 24)  return `${Math.round(diffH)}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30)  return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Filter select (modal-based to avoid ScrollView clipping) ──────────────

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
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
                <Text style={[
                  styles.pickerOptText,
                  { color: opt.value === value ? colors.primary : colors.text },
                ]}>
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

// ── Device table ───────────────────────────────────────────────────────────

const FIXED_COLS_W = 90 + 120 + 90 + 90 + 110; // type+vendor+module+status+lastSync

function DeviceTable({ devices }: { devices: UnifiedDevice[] }) {
  const colors = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = screenWidth - 32;
  const patientColW = Math.max(140, availableWidth - FIXED_COLS_W);
  const tableWidth  = Math.max(patientColW + FIXED_COLS_W, availableWidth);

  if (devices.length === 0) {
    return (
      <View style={[styles.emptyBox, { borderColor: colors.border }]}>
        <Cpu size={28} color={colors.textSecondary} strokeWidth={1.5} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No devices match filters</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width: tableWidth, minWidth: tableWidth }}>
        {/* Header */}
        <View style={[styles.tableHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.th, { width: patientColW, color: colors.textSecondary }]}>DEVICE / PATIENT</Text>
          <Text style={[styles.th, { width: 90,  color: colors.textSecondary }]}>TYPE</Text>
          <Text style={[styles.th, { width: 120, color: colors.textSecondary }]}>VENDOR</Text>
          <Text style={[styles.th, { width: 90,  color: colors.textSecondary }]}>MODULE</Text>
          <Text style={[styles.th, { width: 110, color: colors.textSecondary }]}>STATUS</Text>
          <Text style={[styles.th, { width: 90,  color: colors.textSecondary }]}>LAST SYNC</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
          {devices.map((d, i) => (
            <View
              key={d.id}
              style={[
                styles.tableRow,
                { borderBottomColor: colors.border },
                i % 2 === 0 && { backgroundColor: colors.background },
              ]}>
              {/* Device serial + patient */}
              <View style={{ width: patientColW, paddingRight: 8 }}>
                <Text style={[styles.serial, { color: colors.text }]} numberOfLines={1}>
                  {d.serial || '—'}
                </Text>
                {d.patientName && (
                  <Text style={[styles.patientSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {d.patientName}
                  </Text>
                )}
                {d.facilityName && (
                  <Text style={[styles.facilitySub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {d.facilityName}
                  </Text>
                )}
              </View>
              <Text style={[styles.td, { width: 90,  color: colors.text }]} numberOfLines={1}>{d.type}</Text>
              <View style={{ width: 120, justifyContent: 'center' }}>
                <View style={[
                  styles.vendorPill,
                  { backgroundColor: d.vendor === 'Tenovi' ? colors.info + '18' : colors.primary + '18' },
                ]}>
                  <Text style={[
                    styles.vendorPillText,
                    { color: d.vendor === 'Tenovi' ? colors.info : colors.primary },
                  ]}>
                    {d.vendor}
                  </Text>
                </View>
              </View>
              <View style={{ width: 90, justifyContent: 'center' }}>
                <StatusPill tone={d.module === 'RTM' ? 'warning' : 'info'}>{d.module}</StatusPill>
              </View>
              <View style={{ width: 110, justifyContent: 'center' }}>
                <StatusPill tone={deviceTone(d.status)}>
                  {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                </StatusPill>
              </View>
              <View style={{ width: 90, justifyContent: 'center' }}>
                {d.lastMeasurement ? (
                  <View style={styles.syncRow}>
                    <Activity size={11} color={colors.success} />
                    <Text style={[styles.syncText, { color: colors.textSecondary }]}>
                      {fmtTime(d.lastMeasurement)}
                    </Text>
                  </View>
                ) : d.shippedDate ? (
                  <Text style={[styles.td, { color: colors.textSecondary }]}>
                    Shipped {fmtTime(d.shippedDate)}
                  </Text>
                ) : (
                  <Text style={[styles.td, { color: colors.textSecondary }]}>—</Text>
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

type VendorFilter = '' | 'Tenovi' | 'SmartMeter';
type TypeFilter   = '' | 'BP Monitor' | 'Glucometer' | 'Scale' | 'Pulse Ox' | 'RTM Pillbox' | 'Gateway';
type ModuleFilter = '' | 'RPM' | 'RTM';

const VENDOR_OPTIONS = [
  { label: 'Tenovi', value: 'Tenovi' },
  { label: 'SmartMeter', value: 'SmartMeter' },
];
const TYPE_OPTIONS = [
  { label: 'BP Monitor',    value: 'BP Monitor' },
  { label: 'Glucometer',    value: 'Glucometer' },
  { label: 'Scale',         value: 'Scale' },
  { label: 'Pulse Ox',      value: 'Pulse Ox' },
  { label: 'RTM Pillbox',   value: 'RTM Pillbox' },
  { label: 'Gateway',       value: 'Gateway' },
];
const MODULE_OPTIONS = [
  { label: 'RPM', value: 'RPM' },
  { label: 'RTM', value: 'RTM' },
];

export default function DevicesScreen() {
  const colors = useTheme();
  const { session } = useAuth();

  const [devices, setDevices]   = useState<UnifiedDevice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch]       = useState('');
  const [vendor, setVendor]       = useState<VendorFilter>('');
  const [type, setType]           = useState<TypeFilter>('');
  const [module, setModule]       = useState<ModuleFilter>('');

  const load = useCallback(async (showSpinner = true) => {
    if (!session?.token) return;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const { devices: data } = await api.listDevices(session.token);
      setDevices(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load devices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.token]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return devices.filter((d) => {
      if (vendor && d.vendor !== vendor) return false;
      if (type   && d.type   !== type)   return false;
      if (module && d.module !== module) return false;
      if (q && !d.serial.toLowerCase().includes(q) &&
               !(d.patientName ?? '').toLowerCase().includes(q) &&
               !(d.facilityName ?? '').toLowerCase().includes(q) &&
               !d.type.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [devices, search, vendor, type, module]);

  // KPI counts
  const total        = devices.length;
  const connected    = devices.filter((d) => d.connected === true || d.status === 'connected').length;
  const disconnected = devices.filter((d) => d.connected === false || d.status === 'disconnected').length;
  const rpmCount     = devices.filter((d) => d.module === 'RPM').length;
  const rtmCount     = devices.filter((d) => d.module === 'RTM').length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow="Inventory"
          title="Device Fleet"
          description="Smart Meter & Tenovi devices across all clinics."
        />

        {/* KPI cards */}
        <View style={styles.kpiRow}>
          <KpiCard label="Total Devices" value={total} icon={Cpu}    tone="primary" />
          <KpiCard label="Connected"     value={connected}    icon={Wifi}    tone="success" />
          <KpiCard label="Disconnected"  value={disconnected} icon={WifiOff} tone="muted"   />
          <KpiCard label="RPM Devices"   value={rpmCount}     icon={Signal}  tone="info"    />
          <KpiCard label="RTM Devices"   value={rtmCount}     icon={Zap}     tone="warning" />
        </View>

        {/* Filters */}
        <Card style={styles.filterCard}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Search serial, patient, clinic…"
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.filterRow}>
            <FilterSelect
              label="All Vendors"
              value={vendor}
              options={VENDOR_OPTIONS}
              onChange={(v) => setVendor(v as VendorFilter)}
            />
            <FilterSelect
              label="All Types"
              value={type}
              options={TYPE_OPTIONS}
              onChange={(v) => setType(v as TypeFilter)}
            />
            <FilterSelect
              label="All Modules"
              value={module}
              options={MODULE_OPTIONS}
              onChange={(v) => setModule(v as ModuleFilter)}
            />
            <Pressable
              onPress={() => { setSearch(''); setVendor(''); setType(''); setModule(''); }}
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
            Showing {filtered.length} of {total} devices
          </Text>
        </Card>

        {/* Table */}
        <Card style={styles.tableCard}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading devices from SmartMeter & Tenovi…
              </Text>
              <Text style={[styles.loadingHint, { color: colors.textSecondary }]}>
                First load may take up to 30s while fetching live data
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
            <DeviceTable devices={filtered} />
          )}
        </Card>

        {/* Legend */}
        <View style={styles.legendRow}>
          {[
            { color: colors.success,  label: 'Connected / Active' },
            { color: colors.info,     label: 'Shipped / In Transit' },
            { color: colors.primary,  label: 'Delivered' },
            { color: colors.mutedForeground, label: 'Disconnected' },
            { color: colors.warning,  label: 'Returned' },
          ].map(({ color, label }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1 },
  scroll:    { padding: 16, gap: 16, paddingBottom: 40 },
  kpiRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterCard:{ gap: 10 },
  tableCard: { overflow: 'hidden' },
  center:    { alignItems: 'center', paddingVertical: 40, gap: 12 },

  searchInput: {
    height: 38, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12,
    fontSize: 13,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, minWidth: 100, maxWidth: 160,
  },
  filterBtnText: { fontSize: 12, fontWeight: '600', flex: 1 },
  clearBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
  },
  clearBtnText: { fontSize: 12, fontWeight: '600' },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
  },
  refreshBtnText: { fontSize: 12, fontWeight: '600' },
  countLabel: { fontSize: 11.5 },

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

  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  th: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  td:          { fontSize: 12.5, fontWeight: '500' },
  serial:      { fontSize: 12.5, fontWeight: '700', fontFamily: 'monospace' },
  patientSub:  { fontSize: 11, marginTop: 1 },
  facilitySub: { fontSize: 10.5, marginTop: 1, fontStyle: 'italic' },
  vendorPill: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  vendorPillText: { fontSize: 11, fontWeight: '700' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  syncText: { fontSize: 11.5 },

  emptyBox:  { alignItems: 'center', paddingVertical: 40, gap: 10, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed' },
  emptyText: { fontSize: 13 },
  loadingText: { fontSize: 13, textAlign: 'center' },
  loadingHint: { fontSize: 11, textAlign: 'center' },
  errorText:   { fontSize: 13, textAlign: 'center' },
  retryBtn:    { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText:{ color: '#fff', fontWeight: '700', fontSize: 13 },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },

});
