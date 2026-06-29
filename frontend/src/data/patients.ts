import { clinics } from "./clinics";
import { rand, randInt, pick, setSeed } from "./seed";

setSeed(99);

export type Program = "RPM" | "RTM" | "CCM" | "PCM";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Compliance = "on_track" | "at_risk" | "non_compliant";
export type Diagnosis = "Hypertension" | "Type 2 Diabetes" | "CHF" | "COPD" | "Chronic Pain" | "Medication Adherence";

export type Patient = {
  id: string;
  name: string;
  dob: string;
  age: number;
  sex: "M" | "F";
  clinicId: string;
  providerName: string;
  assignedStaff: string;
  program: Program;
  diagnoses: Diagnosis[];
  insurance: string;
  device: string;
  lastReading: string;
  readings: number;
  minutes: number;
  compliance: Compliance;
  billingReady: number; // 0-100
  risk: RiskLevel;
  alerts: number;
  language: "EN" | "ES" | "AR";
  consent: boolean;
  phone: string;
};

const firsts = ["James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Barbara","William","Susan","Richard","Jessica","Joseph","Sarah","Thomas","Karen","Charles","Nancy","Christopher","Lisa","Daniel","Margaret","Matthew","Betty","Anthony","Sandra","Mark","Ashley","Donald","Kimberly","Steven","Emily","Paul","Donna","Andrew","Michelle","Joshua","Carol","Kenneth","Amanda","Kevin","Melissa","Brian","Deborah","George","Stephanie","Edward","Dorothy","Jose","Helen","Maria","Carmen","Luis"];
const lasts = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts"];
const providers = ["Dr. Patel","Dr. Chen","Dr. Okafor","Dr. Reyes","Dr. Cohen","NP Bennett","NP Singh","PA Walsh","Dr. Becker","Dr. Iwu"];
const staff = ["Maria Lopez, MA","Jordan Reed, RN","Aisha Khan, CC","Devon Park, MA","Priya Shah, RN","Carlos Diaz, CC","Hannah Lin, MA","Tre Williams, RN"];
const insurances = ["Medicare Part B","Aetna","UnitedHealthcare","BCBS","Humana","Cigna","Medicare Advantage"];
const devices = ["Smart Meter iBP","Smart Meter iGlucose","Tenovi Scale","Tenovi Pulse Ox","Tenovi RTM Pillbox","Tenovi Gateway"];

const diagnosesByProgram: Record<Program, Diagnosis[]> = {
  RPM: ["Hypertension", "Type 2 Diabetes", "CHF", "COPD"],
  RTM: ["COPD", "Chronic Pain", "Medication Adherence"],
  CCM: ["Hypertension", "Type 2 Diabetes", "CHF", "Chronic Pain"],
  PCM: ["CHF", "COPD", "Chronic Pain"],
};

function makeName() { return `${pick(firsts)} ${pick(lasts)}`; }
function makeDob() {
  const y = randInt(1935, 1972);
  const m = String(randInt(1, 12)).padStart(2, "0");
  const d = String(randInt(1, 28)).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const patients: Patient[] = Array.from({ length: 64 }, (_, i) => {
  const clinic = pick(clinics);
  const program: Program = pick(["RPM", "RPM", "RPM", "RTM", "CCM", "CCM", "PCM"]);
  const dx = diagnosesByProgram[program];
  const dxCount = randInt(1, 2);
  const dxList = Array.from({ length: dxCount }, () => pick(dx)).filter((v, idx, arr) => arr.indexOf(v) === idx);
  const readings = randInt(0, 28);
  const minutes = randInt(0, 42);
  const billing = Math.min(100, Math.round((readings / 16) * 40 + (minutes / 20) * 50 + (rand() > 0.4 ? 10 : 0)));
  const compliance: Compliance =
    readings >= 16 && minutes >= 20 ? "on_track" : readings >= 10 ? "at_risk" : "non_compliant";
  const risk: RiskLevel = pick(["low", "low", "low", "medium", "medium", "high", "critical"]);
  const dob = makeDob();
  const age = 2025 - parseInt(dob.slice(0, 4));
  return {
    id: `p-${String(i + 1).padStart(4, "0")}`,
    name: makeName(),
    dob,
    age,
    sex: rand() > 0.5 ? "M" : "F",
    clinicId: clinic.id,
    providerName: pick(providers),
    assignedStaff: pick(staff),
    program,
    diagnoses: dxList,
    insurance: pick(insurances),
    device: pick(devices),
    lastReading: `${randInt(0, 6)}h ago`,
    readings,
    minutes,
    compliance,
    billingReady: billing,
    risk,
    alerts: randInt(0, 4),
    language: pick(["EN", "EN", "EN", "ES", "AR"]),
    consent: rand() > 0.1,
    phone: `(${randInt(200, 989)}) ${randInt(200, 989)}-${String(randInt(0, 9999)).padStart(4, "0")}`,
  };
});

export function getPatient(id: string) {
  return patients.find((p) => p.id === id);
}

// Vitals time-series (last 30 days) — deterministic
export function vitalsFor(patientId: string) {
  setSeed(parseInt(patientId.slice(-4)) || 1);
  return Array.from({ length: 30 }, (_, i) => ({
    day: `D${i + 1}`,
    systolic: 118 + randInt(-8, 18),
    diastolic: 76 + randInt(-6, 12),
    glucose: 120 + randInt(-20, 50),
    weight: 178 + randInt(-3, 3),
    spo2: 96 + randInt(-3, 2),
    pain: randInt(1, 7),
    mood: randInt(2, 9),
  }));
}