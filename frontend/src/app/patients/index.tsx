import { useRouter } from 'expo-router';
import {
  Activity, ChevronDown, Plus, RefreshCw, Search, User, X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import {
  api,
  ApiError,
  type EnrollPatientInput,
  type Patient,
  type PatientProgram,
  type PatientSource,
} from '@/lib/api';

// ── helpers ────────────────────────────────────────────────────────────────

function ageFromDob(dob: string | null): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return `${age} yrs`;
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

// ── ClinicPickerModal ──────────────────────────────────────────────────────

function ClinicPickerModal({
  visible, clinics, selectedId, onSelect, onClose, colors, loading,
}: {
  visible: boolean;
  clinics: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string, name: string) => void;
  onClose: () => void;
  colors: any;
  loading: boolean;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => clinics.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())),
    [clinics, q],
  );
  useEffect(() => { if (!visible) setQ(''); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={pk.header}>
          <Text style={[pk.title, { color: colors.text }]}>Select Clinic</Text>
          <Pressable onPress={onClose} hitSlop={12}><X size={20} color={colors.textSecondary} /></Pressable>
        </View>
        <View style={[pk.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Search size={14} color={colors.textSecondary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search clinics…"
            placeholderTextColor={colors.textSecondary}
            style={[pk.searchInput, { color: colors.text }]}
            autoFocus
          />
        </View>
        {loading ? (
          <View style={pk.center}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            renderItem={({ item: c }) => (
              <Pressable
                onPress={() => { onSelect(c.id, c.name); onClose(); }}
                style={[
                  pk.row,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: selectedId === c.id ? colors.primary + '14' : 'transparent',
                  },
                ]}>
                <Text style={[pk.rowText, { color: selectedId === c.id ? colors.primary : colors.text, fontWeight: selectedId === c.id ? '700' : '400' }]}>
                  {c.name}
                </Text>
                {selectedId === c.id && <View style={[pk.dot, { backgroundColor: colors.primary }]} />}
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={[pk.emptyHint, { color: colors.textSecondary }]}>
                {q ? 'No clinics match.' : 'No clinics available for this system.'}
              </Text>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── FilterDropdown ─────────────────────────────────────────────────────────

function FilterDropdown<T extends string>({
  label, options, value, onChange, colors,
}: {
  label: string;
  options: { label: string; value: T | '' }[];
  value: T | '';
  onChange: (v: T | '') => void;
  colors: any;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const isActive = !!value;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[fd.chip, { borderColor: isActive ? colors.primary : colors.border, backgroundColor: isActive ? colors.primary + '14' : colors.card }]}>
        <Text style={[fd.chipText, { color: isActive ? colors.primary : colors.textSecondary }]}>
          {selected?.label ?? label}
        </Text>
        <ChevronDown size={11} color={isActive ? colors.primary : colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={fd.backdrop} onPress={() => setOpen(false)}>
          <View style={[fd.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {options.map((o) => (
              <Pressable
                key={String(o.value)}
                onPress={() => { onChange(o.value); setOpen(false); }}
                style={[fd.item, { backgroundColor: value === o.value ? colors.primary + '14' : 'transparent' }]}>
                <Text style={[fd.itemText, { color: value === o.value ? colors.primary : colors.text, fontWeight: value === o.value ? '700' : '400' }]}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ── EnrollModal ────────────────────────────────────────────────────────────

type EnrollForm = {
  system: PatientSource;
  clinicId: string;
  clinicName: string;
  firstName: string;
  lastName: string;
  dob: string;
  sex: 'M' | 'F' | '';
  phone: string;
  language: 'EN' | 'ES' | 'AR';
  insurance: string;
  program: PatientProgram;
  diagnosis: string;
  orderingPhysician: string;
  healthCondition: string;
};

const BLANK: EnrollForm = {
  system: 'smartmeter', clinicId: '', clinicName: '',
  firstName: '', lastName: '', dob: '', sex: '', phone: '',
  language: 'EN', insurance: '', program: 'RPM',
  diagnosis: '', orderingPhysician: '', healthCondition: '',
};

function EField({
  label, value, onChangeText, placeholder, required, colors, keyboard,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; required?: boolean; colors: any;
  keyboard?: 'default' | 'phone-pad';
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[em.label, { color: colors.textSecondary }]}>
        {label.toUpperCase()}{required ? ' *' : ''}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary + '80'}
        keyboardType={keyboard ?? 'default'}
        style={[em.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
    </View>
  );
}

function ESegment<T extends string>({
  label, options, value, onChange, colors, required,
}: {
  label: string; options: { label: string; value: T }[]; value: T | '';
  onChange: (v: T) => void; colors: any; required?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[em.label, { color: colors.textSecondary }]}>
        {label.toUpperCase()}{required ? ' *' : ''}
      </Text>
      <View style={em.segRow}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[em.segBtn, { borderColor: colors.border, backgroundColor: value === o.value ? colors.primary : colors.card }]}>
            <Text style={[em.segBtnText, { color: value === o.value ? '#fff' : colors.textSecondary }]}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function EnrollModal({
  visible, onClose, onSuccess, isSuperAdmin, myClinicId, myClinicName, token, colors,
}: {
  visible: boolean; onClose: () => void; onSuccess: () => void;
  isSuperAdmin: boolean; myClinicId: string | null; myClinicName: string;
  token: string; colors: any;
}) {
  const [form, setForm] = useState<EnrollForm>({ ...BLANK, clinicId: myClinicId ?? '', clinicName: myClinicName });
  const [systemClinics, setSystemClinics] = useState<{ id: string; name: string }[]>([]);
  const [clinicWarning, setClinicWarning] = useState('');
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = useCallback(<K extends keyof EnrollForm>(k: K, v: EnrollForm[K]) =>
    setForm((f) => ({ ...f, [k]: v })), []);

  useEffect(() => {
    if (!visible) return;
    setForm({ ...BLANK, clinicId: myClinicId ?? '', clinicName: myClinicName });
    setError('');
    setClinicWarning('');
  }, [visible, myClinicId, myClinicName]);

  const currentSystem = form.system;
  useEffect(() => {
    if (!visible || !isSuperAdmin) return;
    setLoadingClinics(true);
    setClinicWarning('');
    setForm((f) => ({ ...f, clinicId: '', clinicName: '' }));
    api.getSystemClinics(token, currentSystem)
      .then((r) => {
        setSystemClinics(r.clinics);
        if (r.warning) setClinicWarning(r.warning);
      })
      .catch(() => setSystemClinics([]))
      .finally(() => setLoadingClinics(false));
  }, [visible, currentSystem, isSuperAdmin, token]);

  async function submit() {
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('First Name and Last Name are required.'); return; }
    if (!form.clinicId) { setError('Please select a clinic.'); return; }
    if (form.dob && !/^\d{4}-\d{2}-\d{2}$/.test(form.dob)) { setError('Date of birth must be YYYY-MM-DD.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payload: EnrollPatientInput = {
        clinicId:          form.clinicId,
        system:            form.system,
        firstName:         form.firstName.trim(),
        lastName:          form.lastName.trim(),
        dob:               form.dob.trim() || undefined,
        sex:               form.sex || undefined,
        program:           form.program,
        phone:             form.phone.trim() || undefined,
        language:          form.language || undefined,
        insurance:         form.insurance.trim() || undefined,
        diagnosis:         form.diagnosis.trim() || undefined,
        orderingPhysician: form.orderingPhysician.trim() || undefined,
        healthCondition:   form.healthCondition.trim() || undefined,
      };
      await api.enrollPatient(token, payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enrollment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={em.header}>
              <Text style={[em.title, { color: colors.text }]}>Enroll Patient</Text>
              <Pressable onPress={onClose} hitSlop={12}><X size={20} color={colors.textSecondary} /></Pressable>
            </View>

            <ScrollView contentContainerStyle={em.body} keyboardShouldPersistTaps="handled">
              <ESegment
                label="System" required
                options={[{ label: 'SmartMeter', value: 'smartmeter' }, { label: 'Tenovi', value: 'tenovi' }]}
                value={form.system}
                onChange={(v) => set('system', v as PatientSource)}
                colors={colors}
              />

              {isSuperAdmin ? (
                <View style={{ marginBottom: 14 }}>
                  <Text style={[em.label, { color: colors.textSecondary }]}>CLINIC *</Text>
                  {clinicWarning ? <Text style={[em.hint, { color: colors.warning }]}>{clinicWarning}</Text> : null}
                  <Pressable
                    onPress={() => setShowPicker(true)}
                    style={[em.dropBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <Text style={[em.dropBtnText, { color: form.clinicName ? colors.text : colors.textSecondary + '80' }]}>
                      {loadingClinics ? 'Loading clinics…' : form.clinicName || 'Select clinic'}
                    </Text>
                    <ChevronDown size={14} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ) : (
                <View style={{ marginBottom: 14 }}>
                  <Text style={[em.label, { color: colors.textSecondary }]}>CLINIC</Text>
                  <Text style={[em.readonly, { color: colors.text }]}>{myClinicName || '—'}</Text>
                </View>
              )}

              <View style={em.row2}>
                <View style={{ flex: 1 }}>
                  <EField label="First Name" required value={form.firstName} onChangeText={(v) => set('firstName', v)} colors={colors} />
                </View>
                <View style={{ flex: 1 }}>
                  <EField label="Last Name" required value={form.lastName} onChangeText={(v) => set('lastName', v)} colors={colors} />
                </View>
              </View>

              <EField label="Date of Birth" value={form.dob} onChangeText={(v) => set('dob', v)} placeholder="YYYY-MM-DD" colors={colors} />
              <ESegment label="Sex" options={[{ label: 'Male', value: 'M' }, { label: 'Female', value: 'F' }]} value={form.sex} onChange={(v) => set('sex', v as 'M' | 'F')} colors={colors} />
              <EField label="Phone" value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="+1 555 000 0000" keyboard="phone-pad" colors={colors} />
              <ESegment
                label="Program" required
                options={[{ label: 'RPM', value: 'RPM' }, { label: 'RTM', value: 'RTM' }, { label: 'CCM', value: 'CCM' }, { label: 'PCM', value: 'PCM' }]}
                value={form.program}
                onChange={(v) => set('program', v as PatientProgram)}
                colors={colors}
              />

              {form.system === 'smartmeter' && (
                <>
                  <EField label="Insurance Type" value={form.insurance} onChangeText={(v) => set('insurance', v)} placeholder="Medicare Part B" colors={colors} />
                  <EField label="Primary Diagnosis" value={form.diagnosis} onChangeText={(v) => set('diagnosis', v)} placeholder="Hypertension" colors={colors} />
                  <ESegment label="Language" options={[{ label: 'English', value: 'EN' }, { label: 'Spanish', value: 'ES' }, { label: 'Arabic', value: 'AR' }]} value={form.language} onChange={(v) => set('language', v as 'EN' | 'ES' | 'AR')} colors={colors} />
                </>
              )}

              {form.system === 'tenovi' && (
                <>
                  <EField label="Health Condition" value={form.healthCondition} onChangeText={(v) => set('healthCondition', v)} placeholder="hypertension" colors={colors} />
                  <EField label="Ordering Physician" value={form.orderingPhysician} onChangeText={(v) => set('orderingPhysician', v)} placeholder="Dr. Name" colors={colors} />
                </>
              )}

              {error ? (
                <View style={[em.errorBox, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '40' }]}>
                  <Text style={[em.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={[em.footer, { borderTopColor: colors.border }]}>
              <Pressable onPress={submit} disabled={submitting} style={[em.submitBtn, { backgroundColor: submitting ? colors.primary + '80' : colors.primary }]}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={em.submitBtnText}>Enroll Patient</Text>}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <ClinicPickerModal
        visible={showPicker}
        clinics={systemClinics}
        selectedId={form.clinicId}
        onSelect={(id, name) => { set('clinicId', id); set('clinicName', name); }}
        onClose={() => setShowPicker(false)}
        colors={colors}
        loading={loadingClinics}
      />
    </>
  );
}

// ── Patient card ───────────────────────────────────────────────────────────

function PatientCard({ patient, colors }: { patient: Patient; colors: any }) {
  const router = useRouter();
  const nameParts = patient.full_name.trim().split(' ');
  const initials  = ((nameParts[0]?.[0] ?? '') + (nameParts[nameParts.length - 1]?.[0] ?? '')).toUpperCase();

  return (
    <Pressable onPress={() => router.push(`/patients/${patient.id}`)}>
      <Card style={cd.root}>
        <View style={cd.top}>
          <View style={[cd.avatar, { backgroundColor: colors.primary + '18' }]}>
            <Text style={[cd.avatarText, { color: colors.primary }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[cd.name, { color: colors.text }]}>{patient.full_name}</Text>
            <Text style={[cd.meta, { color: colors.textSecondary }]}>
              {ageFromDob(patient.dob)} · {patient.sex === 'M' ? 'Male' : patient.sex === 'F' ? 'Female' : '—'}
            </Text>
            <Text style={[cd.meta, { color: colors.textSecondary }]} numberOfLines={1}>
              {patient.clinic_name ?? 'Unknown clinic'}
            </Text>
            {patient.diagnoses?.[0] ? (
              <Text style={[cd.diag, { color: colors.textSecondary }]} numberOfLines={1}>
                {patient.diagnoses[0]}
              </Text>
            ) : null}
          </View>
          <View style={cd.badges}>
            <StatusPill tone={enrollTone(patient.enrollment_status)}>{patient.enrollment_status}</StatusPill>
            {patient.risk !== 'low' && <StatusPill tone={riskTone(patient.risk)}>{patient.risk}</StatusPill>}
          </View>
        </View>
        <View style={cd.bottom}>
          <View style={[cd.chip, { borderColor: colors.border }]}>
            <Text style={[cd.chipText, { color: colors.text }]}>{patient.program}</Text>
          </View>
          <View style={[cd.chip, { borderColor: colors.border }]}>
            <Activity size={9} color={colors.textSecondary} />
            <Text style={[cd.chipText, { color: colors.textSecondary }]}>
              {patient.source === 'tenovi' ? 'Tenovi' : 'SmartMeter'}
            </Text>
          </View>
          {patient.insurance_payer ? (
            <Text style={[cd.meta, { color: colors.textSecondary }]} numberOfLines={1}>{patient.insurance_payer}</Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

// ── Filter options ─────────────────────────────────────────────────────────

const SOURCE_OPTS: { label: string; value: PatientSource | '' }[] = [
  { label: 'All Systems',  value: '' },
  { label: 'Tenovi',       value: 'tenovi' },
  { label: 'SmartMeter',   value: 'smartmeter' },
];
const PROGRAM_OPTS: { label: string; value: PatientProgram | '' }[] = [
  { label: 'All Programs', value: '' },
  { label: 'RPM', value: 'RPM' }, { label: 'RTM', value: 'RTM' },
  { label: 'CCM', value: 'CCM' }, { label: 'PCM', value: 'PCM' },
];
const STATUS_OPTS = [
  { label: 'All Statuses', value: '' },
  { label: 'Active',     value: 'active'     },
  { label: 'Pending',    value: 'pending'    },
  { label: 'Hold',       value: 'hold'       },
  { label: 'Discharged', value: 'discharged' },
  { label: 'Declined',   value: 'declined'   },
];
const RISK_OPTS = [
  { label: 'All Risk',  value: '' },
  { label: 'Low',      value: 'low'      },
  { label: 'Medium',   value: 'medium'   },
  { label: 'High',     value: 'high'     },
  { label: 'Critical', value: 'critical' },
];

// ── Main screen ────────────────────────────────────────────────────────────

export default function PatientsScreen() {
  const colors = useTheme();
  const { session } = useAuth();
  const isSuperAdmin  = session?.user.role === 'super_admin';
  const isClinicAdmin = session?.user.role === 'clinic_admin';

  const [patients, setPatients]     = useState<Patient[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);

  const [q, setQ]             = useState('');
  const [source, setSource]   = useState<PatientSource | ''>('');
  const [program, setProgram] = useState<PatientProgram | ''>('');
  const [status, setStatus]   = useState('');
  const [risk, setRisk]       = useState('');
  const [clinicId, setClinicId] = useState('');
  const [allClinics, setAllClinics] = useState<{ id: string; name: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const myClinicName = useMemo(
    () => allClinics.find((c) => c.id === session?.user.clinicId)?.name ?? '',
    [allClinics, session],
  );

  const clinicOpts = useMemo(
    () => [{ label: 'All Clinics', value: '' }, ...allClinics.map((c) => ({ label: c.name, value: c.id }))],
    [allClinics],
  );

  useEffect(() => {
    if (!session || !isSuperAdmin) return;
    api.listClinics(session.token).then((r) => setAllClinics(r.clinics)).catch(() => {});
  }, [session, isSuperAdmin]);

  const load = useCallback(async (isRefresh = false) => {
    if (!session) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.listPatients(session.token, {
        search:   q        || undefined,
        source:   source   || undefined,
        program:  program  || undefined,
        status:   status   || undefined,
        risk:     risk     || undefined,
        clinicId: clinicId || undefined,
      });
      setPatients(res.patients);
      setTotal(res.total);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, q, source, program, status, risk, clinicId]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(), q ? 400 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [load, q]);

  const anyFilter = !!source || !!program || !!status || !!risk || !!clinicId;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.content}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        ListHeaderComponent={
          <View>
            <View style={s.headerRow}>
              <PageHeader
                eyebrow="Registry"
                title="Patient Registry"
                description={loading ? 'Loading…' : `${total.toLocaleString()} patient${total !== 1 ? 's' : ''}`}
              />
              <View style={s.headerActions}>
                <Pressable onPress={() => load(true)} style={[s.iconBtn, { borderColor: colors.border }]}>
                  <RefreshCw size={15} color={colors.textSecondary} />
                </Pressable>
                {(isSuperAdmin || isClinicAdmin) && (
                  <Pressable onPress={() => setShowEnroll(true)} style={[s.enrollBtn, { backgroundColor: colors.primary }]}>
                    <Plus size={15} color="#fff" />
                    <Text style={s.enrollBtnText}>Enroll</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={[s.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Search size={14} color={colors.textSecondary} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search patients by name…"
                placeholderTextColor={colors.textSecondary}
                style={[s.searchInput, { color: colors.text }]}
              />
              {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><X size={13} color={colors.textSecondary} /></Pressable> : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.filterRow}
              contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
              <FilterDropdown label="All Systems"  options={SOURCE_OPTS}  value={source}  onChange={setSource}  colors={colors} />
              <FilterDropdown label="All Programs" options={PROGRAM_OPTS} value={program} onChange={setProgram} colors={colors} />
              <FilterDropdown label="All Statuses" options={STATUS_OPTS}  value={status}  onChange={(v) => setStatus(v)} colors={colors} />
              <FilterDropdown label="All Risk"     options={RISK_OPTS}    value={risk}    onChange={(v) => setRisk(v)}   colors={colors} />
              {isSuperAdmin && (
                <FilterDropdown
                  label="All Clinics"
                  options={clinicOpts}
                  value={clinicId}
                  onChange={(v) => setClinicId(v)}
                  colors={colors}
                />
              )}
              {anyFilter && (
                <Pressable
                  onPress={() => { setSource(''); setProgram(''); setStatus(''); setRisk(''); setClinicId(''); }}
                  style={[fd.chip, { borderColor: colors.destructive + '60', backgroundColor: colors.destructive + '12' }]}>
                  <Text style={[fd.chipText, { color: colors.destructive }]}>Clear</Text>
                  <X size={10} color={colors.destructive} />
                </Pressable>
              )}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => <PatientCard patient={item} colors={colors} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            {loading ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : (
              <>
                <User size={36} color={colors.textSecondary} />
                <Text style={[s.emptyTitle, { color: colors.text }]}>No patients found</Text>
                <Text style={[s.emptyDesc, { color: colors.textSecondary }]}>
                  {anyFilter || q
                    ? 'Try adjusting your filters or search.'
                    : 'Patients sync hourly from Tenovi & SmartMeter.\nPull down to refresh or tap Enroll to add one now.'}
                </Text>
              </>
            )}
          </View>
        }
      />

      {session && (
        <EnrollModal
          visible={showEnroll}
          onClose={() => setShowEnroll(false)}
          onSuccess={() => load()}
          isSuperAdmin={isSuperAdmin}
          myClinicId={session.user.clinicId}
          myClinicName={myClinicName}
          token={session.token}
          colors={colors}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content:       { padding: 16, paddingBottom: 48 },
  headerRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  iconBtn:       { width: 34, height: 34, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  enrollBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  enrollBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  searchBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, height: 40, marginTop: 10 },
  searchInput:   { flex: 1, fontSize: 13 },
  filterRow:     { marginTop: 10, marginBottom: 14 },
  empty:         { alignItems: 'center', gap: 10, paddingVertical: 64 },
  emptyTitle:    { fontSize: 15, fontWeight: '700' },
  emptyDesc:     { fontSize: 12, textAlign: 'center', maxWidth: 270 },
});

const fd = StyleSheet.create({
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: '#00000040', justifyContent: 'center', alignItems: 'center' },
  dropdown: { minWidth: 180, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
  item:     { paddingHorizontal: 16, paddingVertical: 12 },
  itemText: { fontSize: 13 },
});

const cd = StyleSheet.create({
  root:      { gap: 10 },
  top:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bottom:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  avatar:    { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '800' },
  badges:    { alignItems: 'flex-end', gap: 4 },
  name:      { fontSize: 14.5, fontWeight: '700' },
  meta:      { fontSize: 11.5 },
  diag:      { fontSize: 11, fontStyle: 'italic' },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  chipText:  { fontSize: 10.5, fontWeight: '700' },
});

const em = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title:       { fontSize: 17, fontWeight: '800' },
  body:        { paddingHorizontal: 20, paddingBottom: 20 },
  footer:      { borderTopWidth: StyleSheet.hairlineWidth, padding: 16 },
  submitBtn:   { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  label:       { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 },
  input:       { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5 },
  dropBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  dropBtnText: { fontSize: 13.5, flex: 1 },
  readonly:    { fontSize: 13.5, paddingVertical: 4 },
  segRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segBtn:      { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  segBtnText:  { fontSize: 12.5, fontWeight: '600' },
  row2:        { flexDirection: 'row', gap: 12 },
  hint:        { fontSize: 11.5, marginBottom: 4 },
  errorBox:    { borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 4 },
  errorText:   { fontSize: 12.5 },
});

const pk = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title:     { fontSize: 17, fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, height: 40, marginBottom: 4 },
  searchInput: { flex: 1, fontSize: 13 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText:   { flex: 1, fontSize: 14 },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  emptyHint: { textAlign: 'center', fontSize: 13, padding: 32 },
});
