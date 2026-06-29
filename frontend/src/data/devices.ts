import { patients } from "./patients";
import { pick, randInt, setSeed } from "./seed";

setSeed(11);

export type DeviceStatus = "active" | "in_transit" | "in_stock" | "returned" | "lost" | "needs_setup";

export type Device = {
  id: string;
  serial: string;
  type: "BP Monitor" | "Glucometer" | "Scale" | "Pulse Ox" | "RTM Pillbox" | "Gateway";
  vendor: "Smart Meter" | "Tenovi";
  connectivity: "Cellular" | "Bluetooth";
  battery: number;
  lastSync: string;
  patient?: string;
  status: DeviceStatus;
};

const types: Device["type"][] = ["BP Monitor", "Glucometer", "Scale", "Pulse Ox", "RTM Pillbox", "Gateway"];

export const devices: Device[] = Array.from({ length: 80 }, (_, i) => {
  const type = pick(types);
  const status = pick<DeviceStatus>(["active", "active", "active", "active", "in_transit", "in_stock", "returned", "needs_setup"]);
  const patient = status === "active" ? pick(patients).name : undefined;
  return {
    id: `d-${String(i + 1).padStart(4, "0")}`,
    serial: `${type.split(" ")[0].toUpperCase()}-${randInt(10000, 99999)}`,
    type,
    vendor: type === "Glucometer" || type === "BP Monitor" ? "Smart Meter" : "Tenovi",
    connectivity: pick(["Cellular", "Bluetooth"]),
    battery: randInt(15, 100),
    lastSync: status === "active" ? `${randInt(1, 12)}h ago` : "—",
    patient,
    status,
  };
});

export const inventoryStats = {
  active: devices.filter((d) => d.status === "active").length,
  in_stock: devices.filter((d) => d.status === "in_stock").length,
  in_transit: devices.filter((d) => d.status === "in_transit").length,
  returned: devices.filter((d) => d.status === "returned").length,
  needs_setup: devices.filter((d) => d.status === "needs_setup").length,
};