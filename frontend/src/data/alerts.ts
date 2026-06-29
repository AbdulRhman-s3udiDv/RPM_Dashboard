import { patients } from "./patients";
import { pick, rand, randInt, setSeed } from "./seed";

setSeed(7);

export type AlertPriority = "critical" | "high" | "medium" | "low";
export type AlertStatus = "open" | "assigned" | "escalated" | "resolved";

export type Alert = {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  value: string;
  priority: AlertPriority;
  status: AlertStatus;
  triggeredAt: string;
  assignedTo?: string;
  aiRisk: number;
};

const types = [
  { t: "High BP", v: () => `${randInt(160, 195)}/${randInt(98, 115)} mmHg`, p: ["critical", "high"] as const },
  { t: "Low BP", v: () => `${randInt(78, 92)}/${randInt(45, 58)} mmHg`, p: ["high", "medium"] as const },
  { t: "High Glucose", v: () => `${randInt(240, 380)} mg/dL`, p: ["high", "critical"] as const },
  { t: "Low Glucose", v: () => `${randInt(45, 68)} mg/dL`, p: ["critical"] as const },
  { t: "Weight Gain", v: () => `+${randInt(3, 6)} lbs / 3d`, p: ["high", "medium"] as const },
  { t: "Low Oxygen", v: () => `SpO₂ ${randInt(85, 91)}%`, p: ["critical", "high"] as const },
  { t: "Missed Readings", v: () => `${randInt(3, 7)} days`, p: ["medium", "low"] as const },
  { t: "Device Disconnected", v: () => `${randInt(2, 9)}d offline`, p: ["medium"] as const },
  { t: "Med Non-Adherence", v: () => `${randInt(2, 6)} doses missed`, p: ["medium", "high"] as const },
  { t: "High Pain Score", v: () => `${randInt(8, 10)} / 10`, p: ["high"] as const },
];

export const alerts: Alert[] = Array.from({ length: 38 }, (_, i) => {
  const patient = pick(patients);
  const def = pick(types);
  const priority = pick(def.p);
  return {
    id: `a-${String(i + 1).padStart(4, "0")}`,
    patientId: patient.id,
    patientName: patient.name,
    type: def.t,
    value: def.v(),
    priority,
    status: pick(["open", "open", "assigned", "escalated", "resolved"]),
    triggeredAt: `${randInt(2, 59)}m ago`,
    assignedTo: rand() > 0.4 ? pick(["Maria Lopez, MA", "Jordan Reed, RN", "Aisha Khan, CC"]) : undefined,
    aiRisk: randInt(35, 98),
  };
});