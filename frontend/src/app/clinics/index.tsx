import {
  Building2, Plus, X, UserPlus, MapPin, Stethoscope,
  Users, Bell, ShieldCheck, Trash2, Mail, ChevronRight, Key, CheckCircle2,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useAuth } from '@/contexts/auth-context';
import { ROLE_META } from '@/contexts/role-context';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Clinic, type Member, type ClinicBreakdownItem } from '@/lib/api';

// ── types ─────────────────────────────────────────────────────────────────
type EnrichedClinic = Clinic & {
  stats: ClinicBreakdownItem | null;
  providerCount: number;
};

// ── helpers ───────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Clinic Card ───────────────────────────────────────────────────────────
function ClinicCard({ clinic, onPress }: { clinic: EnrichedClinic; onPress: () => void }) {
  const colors = useTheme();
  const s = clinic.stats;
  const compliance = s?.complianceRate ?? null;

  const toneColor =
    compliance === null ? colors.textSecondary
    : compliance >= 80   ? colors.success
    : compliance >= 60   ? colors.warning
    :                      colors.critical;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
      <Card style={styles.clinicCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: colors.primary + '18' }]}>
            <Building2 size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.clinicName, { color: colors.text }]} numberOfLines={2}>
              {clinic.name}
            </Text>
            {(clinic.specialty || clinic.location) && (
              <View style={styles.metaRow}>
                {clinic.specialty && (
                  <View style={styles.metaChip}>
                    <Stethoscope size={10} color={colors.textSecondary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>{clinic.specialty}</Text>
                  </View>
                )}
                {clinic.location && (
                  <View style={styles.metaChip}>
                    <MapPin size={10} color={colors.textSecondary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>{clinic.location}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          <ChevronRight size={16} color={colors.textSecondary} />
        </View>

        {/* Compliance bar */}
        {s && (
          <View style={styles.complianceRow}>
            <View style={styles.complianceLabelRow}>
              <ShieldCheck size={12} color={toneColor} />
              <Text style={[styles.complianceLabel, { color: toneColor }]}>
                {compliance}% compliance
              </Text>
            </View>
            <ProgressBar value={compliance ?? 0} color={toneColor} />
          </View>
        )}

        {/* Stats grid */}
        <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
          <StatCell label="Patients"  value={s ? s.totalPatients.toLocaleString() : '—'} color={colors.primary} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCell label="Providers" value={clinic.providerCount.toString()} color={colors.success} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatCell
            label="Alerts"
            value={s ? s.unreadAlerts.toLocaleString() : '—'}
            color={s && s.unreadAlerts > 50 ? colors.critical : s && s.unreadAlerts > 10 ? colors.warning : colors.text}
          />
        </View>
      </Card>
    </Pressable>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = useTheme();
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────
export default function ClinicsScreen() {
  const colors = useTheme();
  const { session } = useAuth();
  const isSuperAdmin = session?.user.role === 'super_admin';

  const [clinics, setClinics]       = useState<Clinic[]>([]);
  const [members, setMembers]       = useState<Member[]>([]);
  const [breakdown, setBreakdown]   = useState<ClinicBreakdownItem[]>([]);
  const [loadingBase, setLoadingBase]   = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError]           = useState('');

  const [addOpen, setAddOpen]       = useState(false);
  const [selected, setSelected]     = useState<EnrichedClinic | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteClinicId, setInviteClinicId] = useState<string | null>(null);

  // Load clinics + members
  const loadBase = useCallback(async () => {
    if (!session) return;
    setLoadingBase(true);
    setError('');
    try {
      const [clinicsRes, membersRes] = await Promise.all([
        api.listClinics(session.token),
        api.listMembers(session.token),
      ]);
      setClinics(clinicsRes.clinics);
      setMembers(membersRes.members);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load clinics.');
    } finally {
      setLoadingBase(false);
    }
  }, [session]);

  // Load SmartMeter per-clinic breakdown (slower ~10s)
  const loadStats = useCallback(async () => {
    if (!session) return;
    setLoadingStats(true);
    try {
      const res = await api.getClinicBreakdown(session.token);
      setBreakdown(res.breakdown);
    } catch (_) {
      // Stats are optional — base data still shows without them
    } finally {
      setLoadingStats(false);
    }
  }, [session]);

  useEffect(() => {
    loadBase();
    loadStats();
  }, [loadBase, loadStats]);

  // Merge clinic + SmartMeter stats + provider count
  const enriched: EnrichedClinic[] = clinics.map((c) => ({
    ...c,
    stats: breakdown.find((b) => b.name === c.name) ?? null,
    providerCount: members.filter((m) => m.clinic_id === c.id).length,
  }));

  const openInvite = (clinicId: string) => {
    setInviteClinicId(clinicId);
    setInviteOpen(true);
    setSelected(null);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={styles.content}>
      <PageHeader
        eyebrow="Network"
        title="Clinics"
        description={`${clinics.length} clinics onboarded${loadingStats ? ' · loading live stats…' : ''}`}
        actions={
          isSuperAdmin ? (
            <Pressable onPress={() => setAddOpen(true)} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
              <Plus size={15} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Add clinic</Text>
            </Pressable>
          ) : undefined
        }
      />

      {error ? (
        <Card>
          <Text style={{ color: colors.critical, fontSize: 12.5, fontWeight: '600' }}>{error}</Text>
        </Card>
      ) : loadingBase ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : enriched.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
          <Building2 size={26} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
            No clinics yet. Add one to get started.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {loadingStats && (
            <View style={styles.statsLoadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.statsLoadingText, { color: colors.textSecondary }]}>
                Fetching live stats from all clinics…
              </Text>
            </View>
          )}
          {enriched.map((clinic) => (
            <ClinicCard key={clinic.id} clinic={clinic} onPress={() => setSelected(clinic)} />
          ))}
        </View>
      )}

      {/* ── Modals ── */}
      <AddClinicModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => { setAddOpen(false); loadBase(); }}
      />

      <ClinicDetailSheet
        clinic={selected}
        members={members.filter((m) => m.clinic_id === selected?.id)}
        onClose={() => setSelected(null)}
        onInvite={() => selected && openInvite(selected.id)}
        onMemberRemoved={() => { setSelected(null); loadBase(); }}
        onDeleted={() => { setSelected(null); loadBase(); }}
        onUpdated={() => loadBase()}
        isSuperAdmin={isSuperAdmin}
        session={session}
      />

      <InviteModal
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => { setInviteOpen(false); loadBase(); }}
        clinics={clinics}
        preselectedClinicId={inviteClinicId}
        isSuperAdmin={isSuperAdmin}
        callerClinicId={session?.user.clinicId ?? null}
      />
    </ScrollView>
  );
}

// ── Clinic Detail Bottom Sheet ────────────────────────────────────────────
function ClinicDetailSheet({
  clinic, members, onClose, onInvite, onMemberRemoved, onDeleted, onUpdated, isSuperAdmin, session,
}: {
  clinic: EnrichedClinic | null;
  members: Member[];
  onClose: () => void;
  onInvite: () => void;
  onMemberRemoved: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
  isSuperAdmin: boolean;
  session: { token: string } | null;
}) {
  const colors = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => { if (clinic) { setApiKey(''); setKeySaved(false); } }, [clinic?.id]);

  const handleSaveKey = async () => {
    if (!session || !clinic || !apiKey.trim()) return;
    setSavingKey(true);
    try {
      await api.patchClinic(session.token, clinic.id, { smartmeter_api_key: apiKey.trim() });
      setApiKey('');
      setKeySaved(true);
      onUpdated();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not save API key.');
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemove = (member: Member) => {
    if (!session) return;
    Alert.alert(
      'Remove account',
      `Remove ${member.name}? They'll lose access immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await api.removeMember(session.token, member.id);
              onMemberRemoved();
            } catch (err) {
              Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not remove.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteClinic = () => {
    if (!session || !clinic) return;
    Alert.alert(
      'Delete clinic',
      `Permanently delete "${clinic.name}"? This cannot be undone. All associated data will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteClinic(session.token, clinic.id);
              onDeleted();
            } catch (err) {
              Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not delete clinic.');
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={!!clinic} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.sheetHead}>
            <View style={[styles.sheetIcon, { backgroundColor: colors.primary + '18' }]}>
              <Building2 size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={2}>
                {clinic?.name}
              </Text>
              {(clinic?.specialty || clinic?.location) && (
                <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>
                  {[clinic.specialty, clinic.location].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Stats row */}
          {clinic?.stats && (
            <View style={[styles.sheetStats, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              {[
                ['Patients', clinic.stats.totalPatients.toLocaleString()],
                ['Compliance', `${clinic.stats.complianceRate}%`],
                ['Alerts', clinic.stats.unreadAlerts.toLocaleString()],
                ['Providers', clinic.providerCount.toString()],
              ].map(([label, value]) => (
                <View key={label} style={styles.sheetStatCell}>
                  <Text style={[styles.sheetStatValue, { color: colors.text }]}>{value}</Text>
                  <Text style={[styles.sheetStatLabel, { color: colors.textSecondary }]}>{label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* SmartMeter API Key (super_admin only) */}
          {isSuperAdmin && (
            <View style={[styles.apiKeySection, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
              <View style={styles.apiKeyHeader}>
                <Key size={14} color={colors.primary} />
                <Text style={[styles.apiKeyTitle, { color: colors.text }]}>SmartMeter API Key</Text>
                {(clinic?.hasSmartMeterKey || keySaved) && (
                  <View style={[styles.keyBadge, { backgroundColor: colors.success + '20' }]}>
                    <CheckCircle2 size={11} color={colors.success} />
                    <Text style={[styles.keyBadgeText, { color: colors.success }]}>Connected</Text>
                  </View>
                )}
              </View>
              <TextInput
                value={apiKey}
                onChangeText={setApiKey}
                placeholder={clinic?.hasSmartMeterKey ? 'Enter new key to replace…' : 'Paste SmartMeter API key…'}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={false}
                style={[styles.apiKeyInput, { borderColor: colors.border, color: colors.text }]}
              />
              <Pressable
                onPress={handleSaveKey}
                disabled={savingKey || !apiKey.trim()}
                style={[styles.apiKeySave, { backgroundColor: colors.primary, opacity: (savingKey || !apiKey.trim()) ? 0.45 : 1 }]}>
                <Text style={styles.apiKeySaveText}>{savingKey ? 'Saving…' : 'Save key'}</Text>
              </Pressable>
            </View>
          )}

          {/* Members */}
          <View style={styles.membersHead}>
            <Text style={[styles.membersTitle, { color: colors.text }]}>
              Team ({members.length})
            </Text>
            <Pressable onPress={onInvite} style={[styles.inviteSmall, { backgroundColor: colors.primary }]}>
              <UserPlus size={13} color="#fff" />
              <Text style={styles.inviteSmallText}>Invite</Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {members.length === 0 ? (
              <View style={[styles.emptyMembers, { backgroundColor: colors.surface2 }]}>
                <Mail size={20} color={colors.textSecondary} />
                <Text style={[styles.emptyMembersText, { color: colors.textSecondary }]}>
                  No team members yet — tap Invite to add someone.
                </Text>
              </View>
            ) : (
              members.map((m) => (
                <View key={m.id} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '18' }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>{initials(m.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{m.name}</Text>
                    <Text style={[styles.memberEmail, { color: colors.textSecondary }]} numberOfLines={1}>{m.email}</Text>
                    <StatusPill tone={m.role === 'clinic_admin' ? 'info' : 'muted'}>
                      {ROLE_META[m.role].label}
                    </StatusPill>
                  </View>
                  <Pressable onPress={() => handleRemove(m)} hitSlop={10}>
                    <Trash2 size={16} color={colors.critical} />
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>

          {isSuperAdmin && (
            <Pressable
              onPress={handleDeleteClinic}
              style={[styles.deleteClinicBtn, { borderColor: colors.critical + '40', backgroundColor: colors.critical + '08' }]}>
              <Trash2 size={15} color={colors.critical} />
              <Text style={[styles.deleteClinicText, { color: colors.critical }]}>Delete clinic permanently</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Add Clinic Modal ──────────────────────────────────────────────────────
function AddClinicModal({ visible, onClose, onAdded }: { visible: boolean; onClose: () => void; onAdded: () => void }) {
  const colors = useTheme();
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (visible) { setName(''); setError(''); } }, [visible]);

  const handleSubmit = async () => {
    if (!session) return;
    if (!name.trim()) { setError('Clinic name is required.'); return; }
    setSubmitting(true); setError('');
    try { await api.createClinic(session.token, name.trim()); onAdded(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not add the clinic.'); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Add clinic</Text>
            <Pressable onPress={onClose} hitSlop={10}><X size={18} color={colors.textSecondary} /></Pressable>
          </View>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Clinic name</Text>
          <TextInput
            value={name} onChangeText={setName} placeholder="Riverside Family Medicine"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />
          {error ? <Text style={{ color: colors.critical, fontSize: 12.5, fontWeight: '600', marginTop: 12 }}>{error}</Text> : null}
          <Pressable onPress={handleSubmit} disabled={submitting}
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}>
            <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '700' }}>
              {submitting ? 'Adding…' : 'Add clinic'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Invite Modal ──────────────────────────────────────────────────────────
function InviteModal({
  visible, onClose, onInvited, clinics, preselectedClinicId, isSuperAdmin, callerClinicId,
}: {
  visible: boolean; onClose: () => void; onInvited: () => void;
  clinics: Clinic[]; preselectedClinicId: string | null;
  isSuperAdmin: boolean; callerClinicId: string | null;
}) {
  const colors = useTheme();
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'clinic_admin' | 'staff'>('staff');
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setName(''); setEmail(''); setRole('staff'); setError('');
      setClinicId(preselectedClinicId ?? (isSuperAdmin ? null : callerClinicId));
    }
  }, [visible, preselectedClinicId, isSuperAdmin, callerClinicId]);

  const handleSubmit = async () => {
    if (!session) return;
    if (!name.trim() || !email.trim() || !clinicId) {
      setError('Name, email and clinic are all required.'); return;
    }
    setSubmitting(true); setError('');
    try { await api.inviteMember(session.token, { name: name.trim(), email: email.trim(), role, clinicId }); onInvited(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not send invite.'); }
    finally { setSubmitting(false); }
  };

  const selectedClinicName = clinics.find((c) => c.id === clinicId)?.name;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Invite to RPMCares</Text>
            <Pressable onPress={onClose} hitSlop={10}><X size={18} color={colors.textSecondary} /></Pressable>
          </View>
          {selectedClinicName && (
            <View style={[styles.clinicPill, { backgroundColor: colors.primary + '18' }]}>
              <Building2 size={12} color={colors.primary} />
              <Text style={[styles.clinicPillText, { color: colors.primary }]}>{selectedClinicName}</Text>
            </View>
          )}
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Full name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Jordan Lee"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text }]} />
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="jordan@clinic.com"
            placeholderTextColor={colors.textSecondary} autoCapitalize="none" keyboardType="email-address"
            style={[styles.input, { borderColor: colors.border, color: colors.text }]} />
          {isSuperAdmin && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Role</Text>
              <View style={styles.segmentRow}>
                {(['clinic_admin', 'staff'] as const).map((r) => (
                  <Pressable key={r} onPress={() => setRole(r)}
                    style={[styles.segment, { borderColor: colors.border, backgroundColor: role === r ? colors.primary : colors.card }]}>
                    <Text style={{ color: role === r ? '#fff' : colors.textSecondary, fontSize: 12.5, fontWeight: '600' }}>
                      {ROLE_META[r].label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {!preselectedClinicId && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Clinic</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {clinics.map((c) => (
                      <Pressable key={c.id} onPress={() => setClinicId(c.id)}
                        style={[styles.segment, { borderColor: colors.border, backgroundColor: clinicId === c.id ? colors.primary : colors.card }]}>
                        <Text style={{ color: clinicId === c.id ? '#fff' : colors.textSecondary, fontSize: 12.5, fontWeight: '600' }}>
                          {c.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}
            </>
          )}
          {error ? <Text style={{ color: colors.critical, fontSize: 12.5, fontWeight: '600', marginTop: 12 }}>{error}</Text> : null}
          <Pressable onPress={handleSubmit} disabled={submitting}
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}>
            <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '700' }}>
              {submitting ? 'Sending…' : 'Send invite'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, gap: 0 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },

  statsLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statsLoadingText: { fontSize: 12 },

  // Clinic card
  clinicCard: { padding: 0, overflow: 'hidden', marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, paddingBottom: 10 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  clinicName: { fontSize: 14.5, fontWeight: '800', lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  complianceRow: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  complianceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  complianceLabel: { fontSize: 11.5, fontWeight: '700' },
  statsRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  statCell: { flex: 1, alignItems: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  statValue: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 10.5, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Bottom sheets
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 20, paddingBottom: 36 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 10 },
  sheetIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sheetTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  sheetSub: { fontSize: 12, marginTop: 2 },

  // Clinic detail stats
  sheetStats: { flexDirection: 'row', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16, overflow: 'hidden' },
  sheetStatCell: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  sheetStatValue: { fontSize: 15, fontWeight: '800' },
  sheetStatLabel: { fontSize: 10, marginTop: 2, textTransform: 'uppercase' },

  // Members
  membersHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  membersTitle: { fontSize: 14, fontWeight: '700' },
  inviteSmall: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  inviteSmallText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyMembers: { borderRadius: 12, padding: 20, alignItems: 'center', gap: 8 },
  emptyMembersText: { fontSize: 12.5, textAlign: 'center' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800' },
  memberName: { fontSize: 13.5, fontWeight: '700' },
  memberEmail: { fontSize: 11, marginTop: 1, marginBottom: 5 },

  // Invite modal
  clinicPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 4 },
  clinicPillText: { fontSize: 12, fontWeight: '700' },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input: { height: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, fontSize: 14.5 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  submitBtn: { height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  deleteClinicBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  deleteClinicText: { fontSize: 13.5, fontWeight: '700' },

  // API key section
  apiKeySection: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 16, gap: 10 },
  apiKeyHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  apiKeyTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  keyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  keyBadgeText: { fontSize: 10.5, fontWeight: '700' },
  apiKeyInput: { height: 40, borderWidth: StyleSheet.hairlineWidth, borderRadius: 9, paddingHorizontal: 11, fontSize: 13.5 },
  apiKeySave: { height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  apiKeySaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
