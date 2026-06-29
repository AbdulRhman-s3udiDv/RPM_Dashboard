export const revenueTrend = [
  { month: "Jan", actual: 612000, projected: 640000 },
  { month: "Feb", actual: 648000, projected: 665000 },
  { month: "Mar", actual: 681000, projected: 690000 },
  { month: "Apr", actual: 712000, projected: 720000 },
  { month: "May", actual: 745000, projected: 755000 },
  { month: "Jun", actual: 781000, projected: 790000 },
  { month: "Jul", actual: 812000, projected: 826000 },
  { month: "Aug", actual: 842000, projected: 858000 },
  { month: "Sep", actual: 871000, projected: 890000 },
  { month: "Oct", actual: 905000, projected: 922000 },
  { month: "Nov", actual: 938000, projected: 955000 },
  { month: "Dec", actual: 0, projected: 988000 },
];

export const riskDistribution = [
  { name: "Low", value: 1842, color: "var(--success)" },
  { name: "Medium", value: 1124, color: "var(--info)" },
  { name: "High", value: 612, color: "var(--warning)" },
  { name: "Critical", value: 192, color: "var(--critical)" },
];

export const complianceTrend = Array.from({ length: 12 }, (_, i) => ({
  month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  reading16: 72 + i * 1.5 + (i % 3),
  minutes20: 68 + i * 1.7,
  interactive: 80 + i,
}));

export const staffProductivity = [
  { name: "Maria Lopez", role: "MA", minutes: 1280, patients: 92, calls: 184, notes: 76, escalations: 12 },
  { name: "Jordan Reed", role: "RN", minutes: 1410, patients: 88, calls: 162, notes: 91, escalations: 18 },
  { name: "Aisha Khan", role: "CC", minutes: 1188, patients: 104, calls: 211, notes: 68, escalations: 9 },
  { name: "Devon Park", role: "MA", minutes: 942, patients: 71, calls: 138, notes: 54, escalations: 6 },
  { name: "Priya Shah", role: "RN", minutes: 1356, patients: 96, calls: 172, notes: 88, escalations: 14 },
  { name: "Carlos Diaz", role: "CC", minutes: 1052, patients: 83, calls: 196, notes: 61, escalations: 7 },
  { name: "Hannah Lin", role: "MA", minutes: 1124, patients: 79, calls: 154, notes: 64, escalations: 8 },
  { name: "Tre Williams", role: "RN", minutes: 1268, patients: 86, calls: 148, notes: 82, escalations: 11 },
];

export const billingCodes = [
  { code: "99453", desc: "RPM device setup & patient education", eligible: 184, ready: 162, billed: 148, fee: 19 },
  { code: "99454", desc: "RPM 16+ device readings / 30d", eligible: 1842, ready: 1612, billed: 1488, fee: 50 },
  { code: "99457", desc: "RPM 20 min clinical / 30d", eligible: 1612, ready: 1342, billed: 1228, fee: 49 },
  { code: "99458", desc: "RPM each add'l 20 min", eligible: 942, ready: 712, billed: 624, fee: 41 },
  { code: "98975", desc: "RTM initial set-up", eligible: 88, ready: 72, billed: 64, fee: 19 },
  { code: "98976", desc: "RTM respiratory device", eligible: 122, ready: 96, billed: 84, fee: 50 },
  { code: "98977", desc: "RTM musculoskeletal device", eligible: 104, ready: 86, billed: 72, fee: 50 },
  { code: "98980", desc: "RTM treatment mgmt 20 min", eligible: 188, ready: 144, billed: 122, fee: 49 },
  { code: "98981", desc: "RTM each add'l 20 min", eligible: 92, ready: 64, billed: 51, fee: 41 },
  { code: "99490", desc: "CCM 20 min clinical / 30d", eligible: 1212, ready: 1018, billed: 924, fee: 62 },
  { code: "99439", desc: "CCM each add'l 20 min", eligible: 612, ready: 488, billed: 412, fee: 47 },
  { code: "G0438", desc: "Annual Wellness Visit", eligible: 248, ready: 188, billed: 162, fee: 174 },
];

export const billingFunnel = [
  { stage: "Consent", count: 3812, pct: 100 },
  { stage: "Device setup", count: 3624, pct: 95 },
  { stage: "Device activated", count: 3458, pct: 91 },
  { stage: "16+ readings", count: 2942, pct: 77 },
  { stage: "20+ minutes", count: 2612, pct: 68 },
  { stage: "Interactive comm.", count: 2388, pct: 63 },
  { stage: "Provider sign-off", count: 2188, pct: 57 },
  { stage: "Ready to bill", count: 2088, pct: 55 },
];

export const workflows = [
  { id: "w1", name: "Patient Onboarding", trigger: "New patient enrolled", steps: 7, runs: 1248, success: 97 },
  { id: "w2", name: "Consent Collection", trigger: "Onboarding complete", steps: 4, runs: 1124, success: 92 },
  { id: "w3", name: "Eligibility Verification", trigger: "Consent signed", steps: 3, runs: 1092, success: 88 },
  { id: "w4", name: "Device Ordering", trigger: "Eligibility verified", steps: 5, runs: 988, success: 96 },
  { id: "w5", name: "Missed Readings Follow-up", trigger: "3+ missed days", steps: 4, runs: 842, success: 78 },
  { id: "w6", name: "Non-Compliance Recovery", trigger: "<16 readings @ day 25", steps: 6, runs: 412, success: 71 },
  { id: "w7", name: "Escalation Routing", trigger: "Critical alert", steps: 5, runs: 384, success: 94 },
  { id: "w8", name: "Monthly Billing Sweep", trigger: "Month-end", steps: 8, runs: 12, success: 99 },
  { id: "w9", name: "Disenrollment", trigger: "60d inactive", steps: 6, runs: 142, success: 88 },
  { id: "w10", name: "Device Return", trigger: "Disenrollment", steps: 5, runs: 138, success: 92 },
];

export const aiFeatures = [
  { id: "summary", title: "AI Patient Summary", desc: "One-paragraph clinical recap for any patient.", color: "primary" },
  { id: "call", title: "AI Call Summary", desc: "Transcribe and summarize patient phone calls.", color: "info" },
  { id: "escalation", title: "AI Escalation Summary", desc: "Compresses alert + chart into provider-ready brief.", color: "warning" },
  { id: "doc", title: "AI Documentation Assistant", desc: "Drafts compliant CCM/RPM/RTM time-based notes.", color: "primary" },
  { id: "compliance", title: "AI Compliance Warnings", desc: "Predicts which patients will miss billing thresholds.", color: "warning" },
  { id: "adherence", title: "AI Adherence Predictions", desc: "Forecasts medication non-adherence 7 days out.", color: "info" },
  { id: "risk", title: "AI Risk Scoring", desc: "Real-time risk score blended from vitals + behaviors.", color: "critical" },
  { id: "noshow", title: "AI No-Show Prediction", desc: "Flags appointments likely to be missed.", color: "info" },
];