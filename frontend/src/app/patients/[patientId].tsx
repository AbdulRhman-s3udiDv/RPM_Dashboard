import { Stack, useLocalSearchParams } from 'expo-router';
import {
  Phone, MessageSquare, Video, FileText, AlertTriangle, Sparkles,
  Pill, ClipboardList, HeartPulse, Timer, type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/card';
import { ChartCard } from '@/components/ui/chart-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SimpleBarChart } from '@/components/ui/simple-bar-chart';
import { StatusPill, complianceTone, riskTone } from '@/components/ui/status-pill';
import { useTheme } from '@/hooks/use-theme';
import { clinics } from '@/data/clinics';
import { getPatient, vitalsFor } from '@/data/patients';

const tabs = ['Vitals', 'Devices', 'Medications', 'RTM', 'Notes', 'Time Log', 'Comms', 'Billing'] as const;

export default function PatientDetail() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const colors = useTheme();
  const [tab, setTab] = useState<typeof tabs[number]>('Vitals');
  const patient = getPatient(patientId);

  if (!patient) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.surface }]}>
        <Text style={[styles.notFoundTitle, { color: colors.text }]}>Patient not found</Text>
      </View>
    );
  }

  const clinic = clinics.find((c) => c.id === patient.clinicId)!;
  const vitals = vitalsFor(patient.id);
  const initials = patient.name.split(' ').map((n) => n[0]).join('');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: patient.name }} />

      <Card>
        <View style={styles.headRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '1f' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]}>{patient.name}</Text>
            <View style={styles.badgeRow}>
              <StatusPill tone={riskTone(patient.risk)}>{patient.risk} risk</StatusPill>
              <StatusPill tone={complianceTone(patient.compliance)}>{patient.compliance.replace('_', ' ')}</StatusPill>
              <StatusPill tone={patient.consent ? 'success' : 'warning'}>{patient.consent ? 'Consent on file' : 'Consent pending'}</StatusPill>
            </View>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <Info label="DOB" value={`${patient.dob} (${patient.age})`} colors={colors} />
          <Info label="Sex" value={patient.sex} colors={colors} />
          <Info label="Insurance" value={patient.insurance} colors={colors} />
          <Info label="Language" value={patient.language} colors={colors} />
          <Info label="Phone" value={patient.phone} colors={colors} />
          <Info label="Clinic" value={clinic.name} colors={colors} />
          <Info label="Provider" value={patient.providerName} colors={colors} />
          <Info label="Care Coord." value={patient.assignedStaff} colors={colors} />
        </View>

        <View style={styles.diagnosesRow}>
          {patient.diagnoses.map((d) => (
            <View key={d} style={[styles.diagnosisChip, { backgroundColor: colors.accent }]}>
              <Text style={[styles.diagnosisText, { color: colors.text }]}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={styles.billingRow}>
          <Text style={[styles.billingLabel, { color: colors.textSecondary }]}>BILLING READINESS</Text>
          <Text style={[styles.billingValue, { color: colors.text }]}>{patient.billingReady}%</Text>
          <ProgressBar value={patient.billingReady} color={colors.primary} />
        </View>
      </Card>

      <Card>
        <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>QUICK ACTIONS</Text>
        <View style={styles.quickGrid}>
          <QuickAction icon={Phone} label="Call" colors={colors} />
          <QuickAction icon={MessageSquare} label="SMS" colors={colors} />
          <QuickAction icon={Video} label="Video" colors={colors} />
          <QuickAction icon={FileText} label="Note" colors={colors} />
          <QuickAction icon={AlertTriangle} label="Escalate" colors={colors} />
          <QuickAction icon={ClipboardList} label="Survey" colors={colors} />
        </View>
      </Card>

      <Card style={{ backgroundColor: colors.primary + '0d', borderColor: colors.primary + '40' }}>
        <View style={styles.aiHead}>
          <Sparkles size={14} color={colors.primary} />
          <Text style={[styles.aiEyebrow, { color: colors.primary }]}>AI PATIENT SUMMARY</Text>
        </View>
        <Text style={[styles.aiBody, { color: colors.text }]}>
          {patient.name.split(' ')[0]} is a {patient.age}-year-old enrolled in {patient.program} for {patient.diagnoses.join(' and ')}.
          Logged {patient.readings} readings and {patient.minutes} clinical minutes this period. Compliance is {patient.compliance.replace('_', ' ')}.
          AI flags moderate non-adherence risk; recommend a 5-minute check-in call this week.
        </Text>
      </Card>

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

      {tab === 'Vitals' ? (
        <View style={{ gap: 12 }}>
          <ChartCard title="Blood Pressure" subtitle="Last 30 days · mmHg">
            <SimpleBarChart data={vitals.map((v) => ({ label: '', value: v.systolic }))} color={colors.primary} height={90} />
          </ChartCard>
          <ChartCard title="Glucose" subtitle="Last 30 days · mg/dL">
            <SimpleBarChart data={vitals.map((v) => ({ label: '', value: v.glucose }))} color={colors.warning} height={90} />
          </ChartCard>
          <ChartCard title="Weight" subtitle="Last 30 days · lbs">
            <SimpleBarChart data={vitals.map((v) => ({ label: '', value: v.weight }))} color={colors.success} height={90} />
          </ChartCard>
          <ChartCard title="SpO₂" subtitle="Last 30 days · %">
            <SimpleBarChart data={vitals.map((v) => ({ label: '', value: v.spo2 }))} color={colors.info} height={90} />
          </ChartCard>
        </View>
      ) : (
        <Card style={styles.placeholderCard}>
          {tabIcon(tab) && <PlaceholderIcon tab={tab} colors={colors} />}
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>{tabPlaceholderTitle(tab)}</Text>
          <Text style={[styles.placeholderDesc, { color: colors.textSecondary }]}>{tabPlaceholderDesc(tab)}</Text>
        </Card>
      )}
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
  const map: Record<string, LucideIcon> = {
    Devices: HeartPulse, Medications: Pill, RTM: ClipboardList,
    Notes: FileText, 'Time Log': Timer, Comms: MessageSquare, Billing: FileText,
  };
  return map[tab] ?? null;
}

function PlaceholderIcon({ tab, colors }: { tab: string; colors: ReturnType<typeof useTheme> }) {
  const Icon = tabIcon(tab)!;
  return <Icon size={26} color={colors.textSecondary} />;
}

function tabPlaceholderTitle(tab: string) {
  const map: Record<string, string> = {
    Devices: 'Device timeline', Medications: 'Medication adherence', RTM: 'RTM Questionnaires',
    Notes: 'Clinical notes', 'Time Log': 'Time log', Comms: 'Communications timeline', Billing: 'Billing history',
  };
  return map[tab] ?? tab;
}

function tabPlaceholderDesc(tab: string) {
  const map: Record<string, string> = {
    Devices: 'Active devices, assignment history, connectivity & battery.',
    Medications: 'MAR with daily compliance, missed doses and refill timeline.',
    RTM: 'Past 30 days of pain, mood and adherence assessments.',
    Notes: 'Time-tracked SOAP notes and provider sign-offs.',
    'Time Log': 'CPT-mapped clinical time entries for this patient.',
    Comms: 'Calls, SMS, video visits and alerts in one timeline.',
    Billing: 'Eligible CPT codes by month, payer status, claim outcomes.',
  };
  return map[tab] ?? '';
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundTitle: { fontSize: 16, fontWeight: '700' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  name: { fontSize: 19, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 10 },
  infoItem: { width: '47%' },
  infoLabel: { fontSize: 11, fontWeight: '700' },
  infoValue: { fontSize: 11.5, marginTop: 1 },
  diagnosesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  diagnosisChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  diagnosisText: { fontSize: 11, fontWeight: '600' },
  billingRow: { marginTop: 16, gap: 6 },
  billingLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
  billingValue: { fontSize: 18, fontWeight: '800' },
  quickLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAction: { width: '30.5%', alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12 },
  quickActionLabel: { fontSize: 10.5, fontWeight: '600' },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiEyebrow: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 },
  aiBody: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  tabsRow: { gap: 6, paddingVertical: 2 },
  tabPill: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 7 },
  tabPillText: { fontSize: 12, fontWeight: '600' },
  placeholderCard: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  placeholderTitle: { fontSize: 14, fontWeight: '700' },
  placeholderDesc: { fontSize: 11.5, textAlign: 'center' },
});
