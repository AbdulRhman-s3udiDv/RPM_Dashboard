import { Stack, useLocalSearchParams } from 'expo-router';
import {
  Phone, MessageSquare, Video, FileText, AlertTriangle, Sparkles,
  Pill, ClipboardList, HeartPulse, Timer, type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { api, type Patient } from '@/lib/api';

const tabs = ['Info', 'Vitals', 'Devices', 'Medications', 'Notes', 'Time Log', 'Comms', 'Billing'] as const;

function ageFromDob(dob: string | null): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return String(age);
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

export default function PatientDetail() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const colors = useTheme();
  const { session } = useAuth();
  const [tab, setTab] = useState<typeof tabs[number]>('Info');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !patientId) return;
    api.getPatient(session.token, patientId)
      .then((r) => setPatient(r.patient))
      .catch(() => setPatient(null))
      .finally(() => setLoading(false));
  }, [session, patientId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface }]}>
        <Text style={[styles.notFoundTitle, { color: colors.text }]}>Patient not found</Text>
      </View>
    );
  }

  const nameParts = patient.full_name.trim().split(' ');
  const initials = ((nameParts[0]?.[0] ?? '') + (nameParts[nameParts.length - 1]?.[0] ?? '')).toUpperCase();
  const age = ageFromDob(patient.dob);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: patient.full_name }} />

      {/* Header card */}
      <Card>
        <View style={styles.headRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '1f' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]}>{patient.full_name}</Text>
            <View style={styles.badgeRow}>
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

        <View style={styles.infoGrid}>
          <Info label="DOB"       value={patient.dob ? `${patient.dob} (${age} yrs)` : '—'} colors={colors} />
          <Info label="Sex"       value={patient.sex === 'M' ? 'Male' : patient.sex === 'F' ? 'Female' : '—'} colors={colors} />
          <Info label="Phone"     value={patient.phone ?? '—'} colors={colors} />
          <Info label="Language"  value={patient.language} colors={colors} />
          <Info label="Insurance" value={patient.insurance_payer ?? '—'} colors={colors} />
          <Info label="Clinic"    value={patient.clinic_name ?? '—'} colors={colors} />
          <Info label="MRN"       value={patient.mrn ?? '—'} colors={colors} />
          <Info label="Ext. ID"   value={patient.external_patient_id} colors={colors} />
        </View>

        {patient.diagnoses.length > 0 && (
          <View style={styles.diagnosesRow}>
            {patient.diagnoses.map((d, i) => (
              <View key={i} style={[styles.diagnosisChip, { backgroundColor: colors.accent }]}>
                <Text style={[styles.diagnosisText, { color: colors.text }]}>{d}</Text>
              </View>
            ))}
          </View>
        )}

        {patient.icd10_codes.length > 0 && (
          <View style={styles.diagnosesRow}>
            {patient.icd10_codes.map((c, i) => (
              <View key={i} style={[styles.diagnosisChip, { backgroundColor: colors.border }]}>
                <Text style={[styles.diagnosisText, { color: colors.textSecondary }]}>{c}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Quick actions */}
      <Card>
        <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>QUICK ACTIONS</Text>
        <View style={styles.quickGrid}>
          <QuickAction icon={Phone}         label="Call"    colors={colors} />
          <QuickAction icon={MessageSquare} label="SMS"     colors={colors} />
          <QuickAction icon={Video}         label="Video"   colors={colors} />
          <QuickAction icon={FileText}      label="Note"    colors={colors} />
          <QuickAction icon={AlertTriangle} label="Escalate" colors={colors} />
          <QuickAction icon={ClipboardList} label="Survey"  colors={colors} />
        </View>
      </Card>

      {/* AI summary */}
      <Card style={{ backgroundColor: colors.primary + '0d', borderColor: colors.primary + '40' }}>
        <View style={styles.aiHead}>
          <Sparkles size={14} color={colors.primary} />
          <Text style={[styles.aiEyebrow, { color: colors.primary }]}>AI PATIENT SUMMARY</Text>
        </View>
        <Text style={[styles.aiBody, { color: colors.text }]}>
          {nameParts[0]} is enrolled in {patient.program}
          {patient.diagnoses.length > 0 ? ` for ${patient.diagnoses.join(', ')}` : ''}.
          {patient.dob ? ` Age ${age}.` : ''}
          {' '}Status: {patient.enrollment_status}. Risk level: {patient.risk}.
          Monitored via {patient.source === 'tenovi' ? 'Tenovi' : 'SmartMeter'}.
        </Text>
      </Card>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {tabs.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabPill, { borderColor: colors.border, backgroundColor: tab === t ? colors.primary : colors.card }]}>
            <Text style={[styles.tabPillText, { color: tab === t ? '#fff' : colors.textSecondary }]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card style={styles.placeholderCard}>
        {tabIcon(tab) && <PlaceholderIcon tab={tab} colors={colors} />}
        <Text style={[styles.placeholderTitle, { color: colors.text }]}>{tabPlaceholderTitle(tab)}</Text>
        <Text style={[styles.placeholderDesc, { color: colors.textSecondary }]}>{tabPlaceholderDesc(tab)}</Text>
      </Card>
    </ScrollView>
  );
}

function Info({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.infoItem}>
      <Text style={[styles.infoLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.textSecondary }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function QuickAction({ icon: Icon, label, colors }: { icon: LucideIcon; label: string; colors: ReturnType<typeof useTheme> }) {
  return (
    <Pressable style={[styles.quickAction, { borderColor: colors.border }]}>
      <Icon size={16} color={colors.primary} />
      <Text style={[styles.quickActionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function tabIcon(tab: string): LucideIcon | null {
  const m: Record<string, LucideIcon> = {
    Vitals: HeartPulse, Devices: HeartPulse, Medications: Pill,
    Notes: FileText, 'Time Log': Timer, Comms: MessageSquare, Billing: FileText, RTM: ClipboardList,
  };
  return m[tab] ?? null;
}

function PlaceholderIcon({ tab, colors }: { tab: string; colors: ReturnType<typeof useTheme> }) {
  const Icon = tabIcon(tab)!;
  return <Icon size={26} color={colors.textSecondary} />;
}

function tabPlaceholderTitle(tab: string) {
  const m: Record<string, string> = {
    Info: 'Patient info shown above', Vitals: 'Vitals & readings', Devices: 'Device timeline',
    Medications: 'Medication adherence', Notes: 'Clinical notes',
    'Time Log': 'Time log', Comms: 'Communications timeline', Billing: 'Billing history',
  };
  return m[tab] ?? tab;
}

function tabPlaceholderDesc(tab: string) {
  const m: Record<string, string> = {
    Info: 'Demographics and enrollment details shown in the header above.',
    Vitals: 'Blood pressure, glucose, weight and SpO₂ from Tenovi or SmartMeter.',
    Devices: 'Active devices, assignment history, connectivity & battery.',
    Medications: 'MAR with daily compliance, missed doses and refill timeline.',
    Notes: 'Time-tracked SOAP notes and provider sign-offs.',
    'Time Log': 'CPT-mapped clinical time entries for this patient.',
    Comms: 'Calls, SMS, video visits and alerts in one timeline.',
    Billing: 'Eligible CPT codes by month, payer status, claim outcomes.',
  };
  return m[tab] ?? '';
}

const styles = StyleSheet.create({
  content:      { padding: 16, gap: 12, paddingBottom: 48 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundTitle: { fontSize: 16, fontWeight: '700' },
  headRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:       { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 18, fontWeight: '800' },
  name:         { fontSize: 19, fontWeight: '800' },
  badgeRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  infoGrid:     { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 10 },
  infoItem:     { width: '47%' },
  infoLabel:    { fontSize: 11, fontWeight: '700' },
  infoValue:    { fontSize: 11.5, marginTop: 1 },
  diagnosesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  diagnosisChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  diagnosisText: { fontSize: 11, fontWeight: '600' },
  quickLabel:   { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 },
  quickGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAction:  { width: '30.5%', alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12 },
  quickActionLabel: { fontSize: 10.5, fontWeight: '600' },
  aiHead:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiEyebrow:    { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 },
  aiBody:       { fontSize: 12, lineHeight: 18, marginTop: 8 },
  tabsRow:      { gap: 6, paddingVertical: 2 },
  tabPill:      { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 7 },
  tabPillText:  { fontSize: 12, fontWeight: '600' },
  placeholderCard: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  placeholderTitle: { fontSize: 14, fontWeight: '700' },
  placeholderDesc:  { fontSize: 11.5, textAlign: 'center' },
});
