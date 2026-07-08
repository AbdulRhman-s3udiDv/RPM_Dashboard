import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { getTenoviClientDevices, getTenoviBulkOrders } from "../services/tenovi";
import { getSmartMeterOrders } from "../services/smartmeter";

// ── Unified types ──────────────────────────────────────────────────────────

export type UnifiedDevice = {
  id: string;
  serial: string;
  type: string;
  vendor: "SmartMeter" | "Tenovi";
  module: "RPM" | "RTM";
  status: string;
  patientName: string | null;
  patientExternalId: string | null;
  facilityName: string | null;
  lastMeasurement: string | null;
  connected: boolean | null;
  shippedDate: string | null;
};

export type UnifiedOrder = {
  id: string;
  orderNumber: string;
  source: "SmartMeter" | "Tenovi";
  status: string;
  statusRaw: string;
  patientName: string | null;
  clinicName: string | null;
  devices: string[];
  carrier: string | null;
  tracking: string | null;
  trackingLink: string | null;
  createdAt: string | null;
  shippedOn: string | null;
  deliveredOn: string | null;
  fulfilled: boolean;
};

// ── Device type normalisation ──────────────────────────────────────────────

function normalizeTenoviDeviceType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("bpm") || n.includes("blood pressure") || n.includes("bp monitor")) return "BP Monitor";
  if (n.includes("glucometer") || n.includes("glucose"))  return "Glucometer";
  if (n.includes("scale") || n.includes("weight"))        return "Scale";
  if (n.includes("pulse ox") || n.includes("spo2"))       return "Pulse Ox";
  if (n.includes("pillbox") || n.includes("patchcap") || n.includes("patch")) return "RTM Pillbox";
  if (n.includes("gateway"))                               return "Gateway";
  return name;
}

function normalizeSmDeviceType(model: string, lineName: string): string {
  const m = (model + " " + lineName).toLowerCase();
  if (m.includes("ibp") || m.includes("blood pressure")) return "BP Monitor";
  if (m.includes("iglucose") || m.includes("glucose"))   return "Glucometer";
  if (m.includes("scale") || m.includes("weight"))       return "Scale";
  if (m.includes("pulse") || m.includes("spo2"))         return "Pulse Ox";
  if (m.includes("gateway"))                             return "Gateway";
  if (m.includes("thermometer") || m.includes("temp"))   return "Thermometer";
  return model || "Device";
}

// ── Order status normalisation ─────────────────────────────────────────────

const TENOVI_BULK_STATUS: Record<string, string> = {
  DR: "Draft", RQ: "Requested", PE: "Pending",   CR: "Created",
  OH: "On Hold", RS: "Processing", SH: "Shipped", DE: "Delivered",
  DI: "Dispatched", UP: "Updated", CN: "Confirmed",
  RE: "Returned", RK: "Rerouted", CA: "Cancelled",
};

function normalizeTenoviStatus(raw: string): string {
  return TENOVI_BULK_STATUS[raw] ?? raw;
}

function mapSmOrderStatus(raw: string | null | undefined): string {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("ship") || s.includes("transit"))  return "Shipped";
  if (s.includes("deliver"))                         return "Delivered";
  if (s.includes("active") || s.includes("complet")) return "Active";
  if (s.includes("cancel"))                          return "Cancelled";
  if (s.includes("pending") || s.includes("new"))   return "Pending";
  return raw ?? "Unknown";
}

// ── In-memory cache (avoids re-hitting external APIs on every page load) ──

let _devicesCache: { data: UnifiedDevice[]; expiry: number } | null = null;
let _ordersCache:  { data: UnifiedOrder[];  expiry: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Controllers ────────────────────────────────────────────────────────────

export async function getDevices(_req: Request, res: Response): Promise<void> {
  if (_devicesCache && Date.now() < _devicesCache.expiry) {
    res.json({ devices: _devicesCache.data, count: _devicesCache.data.length, cached: true });
    return;
  }

  const { data: clinics } = await supabaseAdmin.from("clinics").select("id, name, smartmeter_api_key");
  const allClinics = (clinics ?? []) as Array<{ id: string; name: string; smartmeter_api_key: string | null }>;
  const smClinics  = allClinics.filter((c) => c.smartmeter_api_key);

  const [tenoviResult, ...smResults] = await Promise.allSettled([
    getTenoviClientDevices(),
    ...smClinics.map((c) =>
      getSmartMeterOrders(c.smartmeter_api_key!, 30).then((orders) => ({
        clinicId: c.id,
        clinicName: c.name,
        orders,
      })),
    ),
  ]);

  const devices: UnifiedDevice[] = [];

  // Tenovi devices (RPM API)
  if (tenoviResult.status === "fulfilled") {
    for (const d of tenoviResult.value) {
      devices.push({
        id:                 d.id,
        serial:             d.device.hardware_uuid,
        type:               normalizeTenoviDeviceType(d.device.name),
        vendor:             "Tenovi",
        module:             d.module === "RTM" ? "RTM" : "RPM",
        status:             d.connected ? "connected" : "disconnected",
        patientName:        d.patient?.name ?? null,
        patientExternalId:  d.patient?.external_id ?? null,
        facilityName:       d.patient?.facility_name ?? null,
        lastMeasurement:    d.last_measurement ?? null,
        connected:          d.connected,
        shippedDate:        null,
      });
    }
  } else {
    console.warn("[devices] Tenovi client-devices fetch failed:", tenoviResult.reason);
  }

  // SmartMeter devices (derived from recent orders)
  for (const result of smResults) {
    if (result.status !== "fulfilled") {
      console.warn("[devices] SmartMeter orders fetch failed:", result.reason);
      continue;
    }
    const { clinicName, orders } = result.value;
    for (const order of orders) {
      for (const line of order.lines ?? []) {
        if (!line.serial_number && !line.imei) continue;
        devices.push({
          id:                `sm-${order.order_number}-${line.line_item ?? line.sku}`,
          serial:            line.serial_number ?? line.imei ?? order.order_number,
          type:              normalizeSmDeviceType(line.device_model ?? "", line.line_name ?? ""),
          vendor:            "SmartMeter",
          module:            "RPM",
          status:            mapSmOrderStatus(order.status),
          patientName:       order.customer_name ?? null,
          patientExternalId: order.customer_id ?? null,
          facilityName:      clinicName,
          lastMeasurement:   null,
          connected:         null,
          shippedDate:       order.date_shipped ?? null,
        });
      }
    }
  }

  _devicesCache = { data: devices, expiry: Date.now() + CACHE_TTL_MS };
  res.json({ devices, count: devices.length, cached: false });
}

export async function getOrders(_req: Request, res: Response): Promise<void> {
  if (_ordersCache && Date.now() < _ordersCache.expiry) {
    res.json({ orders: _ordersCache.data, count: _ordersCache.data.length, cached: true });
    return;
  }

  const { data: clinics } = await supabaseAdmin.from("clinics").select("id, name, smartmeter_api_key");
  const allClinics = (clinics ?? []) as Array<{ id: string; name: string; smartmeter_api_key: string | null }>;
  const smClinics  = allClinics.filter((c) => c.smartmeter_api_key);

  const [tenoviResult, ...smResults] = await Promise.allSettled([
    getTenoviBulkOrders(),
    ...smClinics.map((c) =>
      getSmartMeterOrders(c.smartmeter_api_key!, 30).then((orders) => ({
        clinicId: c.id,
        clinicName: c.name,
        orders,
      })),
    ),
  ]);

  const orders: UnifiedOrder[] = [];

  // Tenovi bulk orders (HWI API)
  if (tenoviResult.status === "fulfilled") {
    for (const o of tenoviResult.value) {
      const deviceList = (o.contents ?? []).flatMap((c) =>
        Array.from({ length: c.quantity }, () => c.name),
      );
      orders.push({
        id:           o.id,
        orderNumber:  o.order_number,
        source:       "Tenovi",
        status:       normalizeTenoviStatus(o.shipping_status),
        statusRaw:    o.shipping_status,
        patientName:  o.shipping_name ?? null,
        clinicName:   null,
        devices:      deviceList,
        carrier:      null,
        tracking:     null,
        trackingLink: o.shipping_tracking_link ?? null,
        createdAt:    o.created ?? null,
        shippedOn:    o.shipped_on ?? null,
        deliveredOn:  o.delivered_on ?? null,
        fulfilled:    o.fulfilled,
      });
    }
  } else {
    console.warn("[orders] Tenovi bulk-orders fetch failed:", tenoviResult.reason);
  }

  // SmartMeter orders
  for (const result of smResults) {
    if (result.status !== "fulfilled") {
      console.warn("[orders] SmartMeter orders fetch failed:", result.reason);
      continue;
    }
    const { clinicName, orders: smOrders } = result.value;
    for (const o of smOrders) {
      const lines = o.lines ?? [];
      const deviceList = lines
        .map((l) => l.line_name ?? l.device_model ?? l.sku ?? "")
        .filter(Boolean);
      const tracking = lines.find((l) => l.tracking_number)?.tracking_number ?? null;
      orders.push({
        id:           String(o.id),
        orderNumber:  o.order_number,
        source:       "SmartMeter",
        status:       mapSmOrderStatus(o.status),
        statusRaw:    o.status ?? "",
        patientName:  o.customer_name ?? null,
        clinicName,
        devices:      deviceList,
        carrier:      o.carrier ?? null,
        tracking,
        trackingLink: null,
        createdAt:    o.date_created ?? null,
        shippedOn:    o.date_shipped ?? null,
        deliveredOn:  null,
        fulfilled:    !!(o.date_shipped),
      });
    }
  }

  // Newest first
  orders.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  _ordersCache = { data: orders, expiry: Date.now() + CACHE_TTL_MS };
  res.json({ orders, count: orders.length, cached: false });
}

export function invalidateDevicesCache(): void {
  _devicesCache = null;
  _ordersCache  = null;
}
