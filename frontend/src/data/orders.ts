import { clinics } from "./clinics";
import { patients } from "./patients";
import { pick, randInt, setSeed } from "./seed";

setSeed(33);

export type OrderStatus = "pending" | "approved" | "ordered" | "shipped" | "delivered" | "activated" | "returned" | "reassigned" | "cancelled";

export type DeviceOrder = {
  id: string;
  patient: string;
  clinic: string;
  program: "RPM" | "RTM" | "CCM";
  devices: string[];
  carrier: "UPS" | "FedEx" | "USPS";
  tracking: string;
  status: OrderStatus;
  createdAt: string;
  serial: string;
};

const carriers = ["UPS", "FedEx", "USPS"] as const;
const deviceCombos = [
  ["Smart Meter iBP"],
  ["Smart Meter iGlucose"],
  ["Tenovi Scale", "Tenovi Gateway"],
  ["Tenovi Pulse Ox", "Tenovi Gateway"],
  ["Tenovi RTM Pillbox"],
  ["Smart Meter iBP", "Smart Meter iGlucose"],
];

export const orders: DeviceOrder[] = Array.from({ length: 28 }, (_, i) => {
  const p = pick(patients);
  const c = clinics.find((x) => x.id === p.clinicId)!;
  return {
    id: `O-${10247 + i}`,
    patient: p.name,
    clinic: c.name,
    program: pick(["RPM", "RTM", "CCM"]),
    devices: pick(deviceCombos),
    carrier: pick(carriers),
    tracking: `1Z${randInt(100000000, 999999999)}`,
    status: pick<OrderStatus>(["pending", "approved", "ordered", "shipped", "shipped", "delivered", "activated", "activated", "returned", "reassigned"]),
    createdAt: `${randInt(1, 28)}d ago`,
    serial: `SN-${randInt(100000, 999999)}`,
  };
});