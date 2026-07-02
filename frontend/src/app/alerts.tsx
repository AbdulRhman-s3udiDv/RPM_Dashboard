import { AlertTriangle, Bell, CheckCircle2, ChevronDown, RefreshCw, UserPlus, X, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type AlertEvent, type AlertStatus, type Member } from '@/lib/api';

const FILTERS: { label: string; value: AlertStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'Escalated', value: 'escalated' },
  { label: 'Resolved', value: 'resolved' },
];

function timeAgo(iso: string | null): string {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AlertsScreen() {
  const colors = useTheme();
  const { session } = useAuth();

  const isSuperAdmin = session?.user.role === 'super_admin';

  const [alerts, setAlerts] = useState<AlertEvent[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [filter, setFilter] = useState<AlertStatus | 'all'>('all');
  const [loadError, setLoadError] = useState('');
  const [assignTarget, setAssignTarget] = useState<AlertEvent | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoadError('');
    try {
      const alertsRes = await api.listAlerts(session.token, filter !== 'all' ? { status: filter } : undefined);
      setAlerts(alertsRes.alerts);
      // Pre-load members only for non-super-admin (their clinic is already scoped by backend)
      if (!isSuperAdmin) {
        const membersRes = await api.listMembers(session.token);
        setMembers(membersRes.members);
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load alerts.');
    }
  }, [session, filter, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  const doUpdate = async (id: string, patch: { status?: AlertStatus; assignedTo?: string | null }) => {
    if (!session) return;
    try {
      const { alert: updated } = await api.updateAlert(session.token, id, patch);
      setAlerts((prev) => prev?.map((a) => (a.id === id ? updated : a)) ?? null);
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  const handleResolve = (a: AlertEvent) => {
    Alert.alert('Resolve alert', `Mark alert for ${a.patient_name} as resolved?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resolve', onPress: () => doUpdate(a.id, { status: 'resolved' }) },
    ]);
  };

  const handleEscalate = (a: AlertEvent) => {
    Alert.alert('Escalate alert', `Escalate alert for ${a.patient_name} to provider?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Escalate', style: 'destructive', onPress: () => doUpdate(a.id, { status: 'escalated' }) },
    ]);
  };

  const openCount = alerts?.filter((a) => a.status === 'open').length ?? 0;
  const criticalCount = alerts?.filter((a) => a.tier === 'CRITICAL' && a.status !== 'resolved').length ?? 0;

  const openAssignModal = useCallback(async (alert: AlertEvent) => {
    setAssignTarget(alert);
    if (isSuperAdmin) {
      // Super admin: fetch members scoped to the alert's clinic
      setMembersLoading(true);
      setMembers([]);
      try {
        const res = await api.listMembers(session!.token, { clinicName: alert.clinic_name });
        setMembers(res.members);
      } catch {
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    }
  }, [session, isSuperAdmin]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={styles.content}>
      <PageHeader
        eyebrow="Triage"
        title="Alerts & Triage"
        description={
          alerts
            ? `${openCount} open  ${criticalCount} critical`
            : 'Live anomaly queue from the monitoring workflow.'
        }
        actions={
          <Pressable onPress={load} style={[styles.refreshBtn, { borderColor: colors.border }]}>
            <RefreshCw size={15} color={colors.textSecondary} />
          </Pressable>
        }
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setFilter(f.value)}
            style={[
              styles.filterChip,
              { borderColor: colors.border, backgroundColor: filter === f.value ? colors.primary : colors.card },
            ]}>
            <Text style={{ color: filter === f.value ? '#fff' : colors.textSecondary, fontSize: 12.5, fontWeight: '600' }}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loadError ? (
        <Card><Text style={{ color: colors.destructive, fontSize: 12.5, fontWeight: '600' }}>{loadError}</Text></Card>
      ) : alerts === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : alerts.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
          <Bell size={28} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
            {filter === 'all' ? 'No alerts yet. They appear here when the monitoring workflow fires.' : `No ${filter} alerts.`}
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {alerts.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              onAssign={() => openAssignModal(a)}
              onEscalate={() => handleEscalate(a)}
              onResolve={() => handleResolve(a)}
            />
          ))}
        </View>
      )}

      <AssignModal
        visible={assignTarget !== null}
        alert={assignTarget}
        members={members}
        membersLoading={membersLoading}
        currentUserId={session?.user.id ?? ''}
        onClose={() => setAssignTarget(null)}
        onAssigned={(memberId) => {
          if (assignTarget) doUpdate(assignTarget.id, { status: 'assigned', assignedTo: memberId });
          setAssignTarget(null);
        }}
      />
    </ScrollView>
  );
}

function AlertCard({
  alert: a, onAssign, onEscalate, onResolve,
}: {
  alert: AlertEvent;
  onAssign: () => void;
  onEscalate: () => void;
  onResolve: () => void;
}) {
  const colors = useTheme();
  const isCritical = a.tier === 'CRITICAL';
  const isResolved = a.status === 'resolved';
  const tierColor = isCritical ? colors.destructive : '#d97706';
  const tierBg = isCritical ? colors.destructive + '18' : '#d9770618';

  const statusTone = (): 'success' | 'critical' | 'warning' | 'muted' => {
    if (a.status === 'resolved') return 'success';
    if (a.status === 'escalated') return 'critical';
    if (a.status === 'assigned') return 'warning';
    return 'muted';
  };

  return (
    <Card style={[styles.alertCard, isResolved && { opacity: 0.55 }]}>
      <View style={[styles.tierStripe, { backgroundColor: tierColor }]} />
      <View style={styles.alertBody}>
        <View style={styles.alertTopRow}>
          <View style={[styles.tierBadge, { backgroundColor: tierBg }]}>
            {isCritical ? <Zap size={11} color={tierColor} /> : <AlertTriangle size={11} color={tierColor} />}
            <Text style={[styles.tierText, { color: tierColor }]}>{isCritical ? 'CRITICAL' : 'NON-CRITICAL'}</Text>
          </View>
          <StatusPill tone={statusTone()}>
            {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
          </StatusPill>
        </View>

        <Text style={[styles.patientName, { color: colors.text }]} numberOfLines={1}>{a.patient_name}</Text>
        <Text style={[styles.clinicLabel, { color: colors.textSecondary }]} numberOfLines={1}>{a.clinic_name}</Text>

        <View style={styles.readingRow}>
          <View style={[styles.readingBox, { backgroundColor: tierBg, borderColor: tierColor + '40' }]}>
            <Text style={[styles.alertTypeLabel, { color: colors.textSecondary }]}>{a.alert_type}</Text>
            <Text style={[styles.readingValue, { color: tierColor }]}>
              {a.value} <Text style={styles.readingUnit}>{a.unit}</Text>
            </Text>
            <Text style={[styles.thresholdText, { color: colors.textSecondary }]}>
              threshold {a.threshold} {a.unit}
            </Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Detected</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>{timeAgo(a.reading_time)}</Text>
            {a.assignee && (
              <>
                <Text style={[styles.metaLabel, { color: colors.textSecondary, marginTop: 8 }]}>Assigned to</Text>
                <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>{a.assignee.name}</Text>
              </>
            )}
            {a.email_sent && (
              <>
                <Text style={[styles.metaLabel, { color: colors.textSecondary, marginTop: 8 }]}>Email</Text>
                <Text style={[styles.metaValue, { color: a.email_sent === 'SENT' ? '#16a34a' : colors.destructive }]}>
                  {a.email_sent}
                </Text>
              </>
            )}
          </View>
        </View>

        {!isResolved && (
          <View style={styles.actionRow}>
            {a.status === 'open' && (
              <ActionButton icon={<UserPlus size={13} color={colors.primary} />} label="Assign" onPress={onAssign} borderColor={colors.border} textColor={colors.primary} />
            )}
            {a.status !== 'escalated' && (
              <ActionButton icon={<AlertTriangle size={13} color="#d97706" />} label="Escalate" onPress={onEscalate} borderColor={colors.border} textColor="#d97706" />
            )}
            <ActionButton icon={<CheckCircle2 size={13} color="#16a34a" />} label="Resolve" onPress={onResolve} borderColor={colors.border} textColor="#16a34a" />
          </View>
        )}
      </View>
    </Card>
  );
}

function ActionButton({ icon, label, onPress, borderColor, textColor }: {
  icon: React.ReactNode; label: string; onPress: () => void; borderColor: string; textColor: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.actionBtn, { borderColor }]}>
      {icon}
      <Text style={{ color: textColor, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function AssignModal({ visible, alert: a, members, membersLoading, currentUserId, onClose, onAssigned }: {
  visible: boolean; alert: AlertEvent | null; members: Member[];
  membersLoading: boolean; currentUserId: string;
  onClose: () => void; onAssigned: (id: string) => void;
}) {
  const colors = useTheme();
  if (!a) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sheetHead}>
            <View>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Assign alert</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{a.clinic_name}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><X size={18} color={colors.textSecondary} /></Pressable>
          </View>
          <Text style={[styles.sheetSub, { color: colors.textSecondary }]} numberOfLines={2}>
            {a.patient_name} · {a.alert_type} ({a.value} {a.unit})
          </Text>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
            <Pressable onPress={() => onAssigned(currentUserId)} style={[styles.memberRow, { borderColor: colors.border }]}>
              <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '20' }]}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>ME</Text>
              </View>
              <Text style={[styles.memberName, { color: colors.primary }]}>Assign to myself</Text>
            </Pressable>
            {membersLoading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
            ) : members.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12.5, textAlign: 'center', paddingVertical: 16 }}>
                No other members in this clinic yet.
              </Text>
            ) : (
              members.map((m) => (
                <Pressable key={m.id} onPress={() => onAssigned(m.id)} style={[styles.memberRow, { borderColor: colors.border }]}>
                  <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                      {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: colors.text }]}>{m.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{m.role.replace('_', ' ')}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  refreshBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  filterRow: { marginBottom: 14 },
  filterChip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  alertCard: { padding: 0, overflow: 'hidden', flexDirection: 'row' },
  tierStripe: { width: 4 },
  alertBody: { flex: 1, padding: 14, gap: 6 },
  alertTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  tierText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
  patientName: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  clinicLabel: { fontSize: 11.5, marginTop: 1 },
  readingRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  readingBox: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, gap: 2 },
  alertTypeLabel: { fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  readingValue: { fontSize: 22, fontWeight: '800' },
  readingUnit: { fontSize: 13, fontWeight: '500' },
  thresholdText: { fontSize: 10.5, marginTop: 2 },
  metaCol: { width: 110, gap: 2 },
  metaLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metaValue: { fontSize: 12.5, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 20, paddingBottom: 36 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 16, fontWeight: '800' },
  sheetSub: { fontSize: 12, marginTop: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12 },
  memberAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  memberName: { fontSize: 13.5, fontWeight: '700' },
});
