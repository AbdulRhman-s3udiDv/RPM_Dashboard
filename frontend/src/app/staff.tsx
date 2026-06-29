import { Mail, Trash2, UserPlus, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { ROLE_META } from '@/contexts/role-context';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Clinic, type Member } from '@/lib/api';

export default function StaffScreen() {
  const colors = useTheme();
  const { session } = useAuth();
  const isSuperAdmin = session?.user.role === 'super_admin';

  const [members, setMembers] = useState<Member[] | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loadError, setLoadError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const clinicName = (id: string | null) => clinics.find((c) => c.id === id)?.name ?? '—';

  const load = useCallback(async () => {
    if (!session) return;
    setLoadError('');
    try {
      const [membersRes, clinicsRes] = await Promise.all([
        api.listMembers(session.token),
        api.listClinics(session.token),
      ]);
      setMembers(membersRes.members);
      setClinics(clinicsRes.clinics);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load staff.');
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = (member: Member) => {
    if (!session) return;
    Alert.alert(
      'Remove account',
      `Remove ${member.name} (${member.email})? They will lose access immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removeMember(session.token, member.id);
              load();
            } catch (err) {
              Alert.alert('Could not remove', err instanceof ApiError ? err.message : 'Something went wrong.');
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={styles.content}>
      <PageHeader
        eyebrow="Care Team"
        title="Staff & Access"
        description={
          isSuperAdmin
            ? 'Manage clinic admins and staff across every clinic.'
            : 'Manage staff accounts for your clinic.'
        }
        actions={
          <Pressable
            onPress={() => setInviteOpen(true)}
            style={[styles.inviteBtn, { backgroundColor: colors.primary }]}>
            <UserPlus size={15} color={colors.primaryForeground} />
            <Text style={[styles.inviteBtnLabel, { color: colors.primaryForeground }]}>Invite</Text>
          </Pressable>
        }
      />

      {loadError ? (
        <Card>
          <Text style={[styles.error, { color: colors.destructive }]}>{loadError}</Text>
        </Card>
      ) : members === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : members.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
          <Mail size={26} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
            No one invited yet. Tap Invite to send the first account-setup email.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {members.map((member) => (
            <Card key={member.id} style={styles.memberRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary + '1f' }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{member.name}</Text>
                <Text style={[styles.memberEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                  {member.email}
                </Text>
                <View style={styles.memberMetaRow}>
                  <StatusPill tone={member.role === 'clinic_admin' ? 'info' : 'muted'}>
                    {ROLE_META[member.role].label}
                  </StatusPill>
                  {isSuperAdmin && (
                    <Text style={[styles.clinicName, { color: colors.textSecondary }]} numberOfLines={1}>
                      {clinicName(member.clinic_id)}
                    </Text>
                  )}
                </View>
              </View>
              <Pressable onPress={() => handleRemove(member)} hitSlop={10} style={styles.removeBtn}>
                <Trash2 size={17} color={colors.destructive} />
              </Pressable>
            </Card>
          ))}
        </View>
      )}

      <InviteModal
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          setInviteOpen(false);
          load();
        }}
        isSuperAdmin={isSuperAdmin}
        clinics={clinics}
        callerClinicId={session?.user.clinicId ?? null}
      />
    </ScrollView>
  );
}

function InviteModal({
  visible, onClose, onInvited, isSuperAdmin, clinics, callerClinicId,
}: {
  visible: boolean;
  onClose: () => void;
  onInvited: () => void;
  isSuperAdmin: boolean;
  clinics: Clinic[];
  callerClinicId: string | null;
}) {
  const colors = useTheme();
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'clinic_admin' | 'staff'>('staff');
  const [clinicId, setClinicId] = useState<string | null>(isSuperAdmin ? null : callerClinicId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setName('');
      setEmail('');
      setRole('staff');
      setClinicId(isSuperAdmin ? null : callerClinicId);
      setError('');
    }
  }, [visible, isSuperAdmin, callerClinicId]);

  const handleSubmit = async () => {
    if (!session) return;
    if (!name.trim() || !email.trim() || !clinicId) {
      setError('Name, email and clinic are all required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.inviteMember(session.token, { name: name.trim(), email: email.trim(), role, clinicId });
      onInvited();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the invite.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Invite to RPMCares</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>
            They'll get an email with a secure link to set up their own password.
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Full name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Jordan Lee"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="jordan@clinic.com"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />

          {isSuperAdmin && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Role</Text>
              <View style={styles.segmentRow}>
                {(['clinic_admin', 'staff'] as const).map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setRole(r)}
                    style={[
                      styles.segment,
                      { borderColor: colors.border, backgroundColor: role === r ? colors.primary : colors.card },
                    ]}>
                    <Text style={{ color: role === r ? '#fff' : colors.textSecondary, fontSize: 12.5, fontWeight: '600' }}>
                      {ROLE_META[r].label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {isSuperAdmin ? (
            <>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Clinic</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {clinics.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setClinicId(c.id)}
                    style={[
                      styles.segment,
                      { borderColor: colors.border, backgroundColor: clinicId === c.id ? colors.primary : colors.card },
                    ]}>
                    <Text style={{ color: clinicId === c.id ? '#fff' : colors.textSecondary, fontSize: 12.5, fontWeight: '600' }}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
                {clinics.length === 0 && (
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>No clinics yet — add one first.</Text>
                )}
              </ScrollView>
            </>
          ) : (
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>
              Role: Staff · Clinic: {clinics.find((c) => c.id === callerClinicId)?.name ?? 'your clinic'}
            </Text>
          )}

          {error ? <Text style={[styles.error, { color: colors.destructive, marginTop: 12 }]}>{error}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submit, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}>
            <Text style={{ color: colors.primaryForeground, fontSize: 14.5, fontWeight: '700' }}>
              {submitting ? 'Sending invite…' : 'Send invite'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
  },
  inviteBtnLabel: { fontSize: 13, fontWeight: '700' },
  error: { fontSize: 12.5, fontWeight: '600' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '800' },
  memberName: { fontSize: 14.5, fontWeight: '700' },
  memberEmail: { fontSize: 11.5, marginTop: 1 },
  memberMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  clinicName: { fontSize: 11, flexShrink: 1 },
  removeBtn: { padding: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 20, paddingBottom: 32 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 16, fontWeight: '800' },
  sheetSub: { fontSize: 12, marginTop: 4 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input: {
    height: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, fontSize: 14.5,
  },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  submit: { height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
});
