export type Clinic = {
  id: string;
  name: string;
  specialty: "Internal Medicine" | "Neurology" | "Cardiology" | "Endocrinology";
  city: string;
  state: string;
  patients: number;
  compliance: number; // 0-100
  monthlyRevenue: number;
  activeAlerts: number;
  providers: number;
  staff: number;
};

export const clinics: Clinic[] = [
  { id: "c-001", name: "Cedar Park Internal Medicine", specialty: "Internal Medicine", city: "Austin", state: "TX", patients: 412, compliance: 92, monthlyRevenue: 84210, activeAlerts: 18, providers: 6, staff: 14 },
  { id: "c-002", name: "Lakeshore Cardiology", specialty: "Cardiology", city: "Chicago", state: "IL", patients: 308, compliance: 88, monthlyRevenue: 71850, activeAlerts: 22, providers: 5, staff: 11 },
  { id: "c-003", name: "Sunbelt Endocrine Group", specialty: "Endocrinology", city: "Phoenix", state: "AZ", patients: 521, compliance: 94, monthlyRevenue: 102430, activeAlerts: 12, providers: 7, staff: 17 },
  { id: "c-004", name: "Atlantic Neurology Partners", specialty: "Neurology", city: "Charlotte", state: "NC", patients: 187, compliance: 81, monthlyRevenue: 41280, activeAlerts: 14, providers: 4, staff: 8 },
  { id: "c-005", name: "Bayview Internal Medicine", specialty: "Internal Medicine", city: "San Diego", state: "CA", patients: 366, compliance: 90, monthlyRevenue: 76110, activeAlerts: 19, providers: 5, staff: 12 },
  { id: "c-006", name: "Heartland Cardiology", specialty: "Cardiology", city: "Kansas City", state: "MO", patients: 244, compliance: 86, monthlyRevenue: 58940, activeAlerts: 9, providers: 4, staff: 9 },
  { id: "c-007", name: "Cascade Endocrinology", specialty: "Endocrinology", city: "Portland", state: "OR", patients: 198, compliance: 89, monthlyRevenue: 47820, activeAlerts: 7, providers: 3, staff: 7 },
  { id: "c-008", name: "Summit Neurology Center", specialty: "Neurology", city: "Denver", state: "CO", patients: 142, compliance: 78, monthlyRevenue: 32600, activeAlerts: 11, providers: 3, staff: 6 },
  { id: "c-009", name: "Riverwalk Internal Medicine", specialty: "Internal Medicine", city: "San Antonio", state: "TX", patients: 489, compliance: 91, monthlyRevenue: 96340, activeAlerts: 24, providers: 7, staff: 15 },
  { id: "c-010", name: "Coastal Cardiology Assoc.", specialty: "Cardiology", city: "Miami", state: "FL", patients: 332, compliance: 87, monthlyRevenue: 78250, activeAlerts: 16, providers: 5, staff: 12 },
  { id: "c-011", name: "Pinewood Endocrine Health", specialty: "Endocrinology", city: "Atlanta", state: "GA", patients: 276, compliance: 84, monthlyRevenue: 64190, activeAlerts: 13, providers: 4, staff: 10 },
  { id: "c-012", name: "Northstar Neurology", specialty: "Neurology", city: "Minneapolis", state: "MN", patients: 165, compliance: 82, monthlyRevenue: 38470, activeAlerts: 8, providers: 3, staff: 7 },
];

export const totals = {
  patients: clinics.reduce((s, c) => s + c.patients, 0),
  revenue: clinics.reduce((s, c) => s + c.monthlyRevenue, 0),
  alerts: clinics.reduce((s, c) => s + c.activeAlerts, 0),
  compliance: Math.round(clinics.reduce((s, c) => s + c.compliance, 0) / clinics.length),
};