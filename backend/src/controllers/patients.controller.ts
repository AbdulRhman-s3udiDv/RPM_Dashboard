import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { findProfileById } from "../models/profile";
import { listPatients, findPatientById, createPatient } from "../models/patient";
import { enrollTenoviPatient, getTenoviFacilities } from "../services/tenovi";
import { enrollSmartMeterPatient } from "../services/smartmeter";

export async function list(req: Request, res: Response) {
  const profile = await findProfileById(req.auth!.sub);
  const { source, status, program, risk, search } = req.query as Record<string, string>;
  const page  = Math.max(0, parseInt(req.query.page  as string) || 0);
  const limit = Math.min(200, Math.max(10, parseInt(req.query.limit as string) || 50));

  let clinicId: string | undefined;
  if (profile && profile.role !== "super_admin") {
    if (!profile.clinic_id) return res.json({ patients: [], total: 0 });
    clinicId = profile.clinic_id;
  } else {
    clinicId = req.query.clinicId as string | undefined;
  }

  const { data, count } = await listPatients({
    clinicId,
    source:  source  || undefined,
    status:  status  || undefined,
    program: program || undefined,
    risk:    risk    || undefined,
    search:  search  || undefined,
    limit,
    offset:  page * limit,
  });

  return res.json({ patients: data, total: count });
}

export async function getOne(req: Request, res: Response) {
  const { id } = req.params;
  const profile = await findProfileById(req.auth!.sub);
  const patient = await findPatientById(id);
  if (!patient) return res.status(404).json({ error: "Patient not found." });
  if (
    profile &&
    profile.role !== "super_admin" &&
    patient.clinic_id !== profile.clinic_id
  ) {
    return res.status(403).json({ error: "Access denied." });
  }
  return res.json({ patient });
}

// ── System-scoped clinic list (for the enrollment modal dropdown) ──────────

export async function getSystemClinics(req: Request, res: Response) {
  const system = req.query.system as string | undefined;

  if (system === "smartmeter") {
    const { data, error } = await supabaseAdmin
      .from("clinics")
      .select("id, name, specialty, location")
      .not("smartmeter_api_key", "is", null)
      .order("name");
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ clinics: data ?? [] });
  }

  if (system === "tenovi") {
    // Fetch Tenovi facilities + our DB clinics in parallel, then intersect by name
    const [facilitiesResult, clinicsResult] = await Promise.allSettled([
      getTenoviFacilities(),
      supabaseAdmin.from("clinics").select("id, name, specialty, location").order("name"),
    ]);

    const dbClinics =
      clinicsResult.status === "fulfilled" ? (clinicsResult.value.data ?? []) : [];

    if (facilitiesResult.status === "rejected") {
      // Tenovi unreachable — return all clinics so the form still works
      return res.json({ clinics: dbClinics, warning: "Could not reach Tenovi to filter clinics." });
    }

    const facilityNames = new Set(
      (facilitiesResult.value as Array<{ name: string }>).map((f) =>
        f.name.toLowerCase().trim(),
      ),
    );
    const matched = (dbClinics as Array<{ id: string; name: string; specialty: string | null; location: string | null }>)
      .filter((c) => facilityNames.has(c.name.toLowerCase().trim()));

    return res.json({ clinics: matched });
  }

  return res.status(400).json({ error: "Query param 'system' must be 'tenovi' or 'smartmeter'." });
}

// ── Enroll patient ─────────────────────────────────────────────────────────

export async function enroll(req: Request, res: Response) {
  const profile = await findProfileById(req.auth!.sub);
  if (!profile) return res.status(401).json({ error: "Not authenticated." });
  if (profile.role !== "super_admin" && profile.role !== "clinic_admin") {
    return res.status(403).json({ error: "Not authorized." });
  }

  const {
    clinicId,
    system: rpmSource,
    firstName,
    lastName,
    dob,
    sex,
    phone,
    language,
    insurance,
    program,
    diagnosis,
    orderingPhysician,
    healthCondition,
  } = req.body as Record<string, string | undefined>;

  if (!clinicId || !rpmSource || !firstName || !lastName || !program) {
    return res.status(400).json({
      error: "Missing required fields: clinicId, system, firstName, lastName, program.",
    });
  }
  if (rpmSource !== "tenovi" && rpmSource !== "smartmeter") {
    return res.status(400).json({ error: "system must be 'tenovi' or 'smartmeter'." });
  }
  if (!["RPM", "RTM", "CCM", "PCM"].includes(program)) {
    return res.status(400).json({ error: "program must be RPM, RTM, CCM, or PCM." });
  }
  if (profile.role === "clinic_admin" && clinicId !== profile.clinic_id) {
    return res.status(403).json({ error: "clinic_admin can only enroll in their own clinic." });
  }

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id, name, smartmeter_api_key")
    .eq("id", clinicId)
    .maybeSingle();
  if (!clinic) return res.status(400).json({ error: "Clinic not found." });

  const fullName   = `${firstName.trim()} ${lastName.trim()}`;
  const diagnoses: string[] = [];
  const diagnosisText = healthCondition || diagnosis;
  if (diagnosisText) diagnoses.push(diagnosisText.trim());

  // External system must succeed before we write to the DB
  let externalPatientId: string;

  if (rpmSource === "tenovi") {
    let facilities: { id: string; name: string }[];
    try {
      facilities = await getTenoviFacilities();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(502).json({ error: `Tenovi unreachable: ${msg}` });
    }

    const facility = facilities.find(
      (f) => f.name.toLowerCase().trim() === clinic.name.toLowerCase().trim(),
    );
    if (!facility) {
      return res.status(422).json({
        error:
          `No Tenovi facility matches clinic "${clinic.name}". ` +
          `Available: ${facilities.map((f) => f.name).join(", ")}`,
      });
    }

    try {
      const result = await enrollTenoviPatient(facility.id, {
        name:              fullName,
        phone:             phone || undefined,
        externalId:        `rpmcares-${Date.now()}`,
        orderingPhysician: orderingPhysician || undefined,
        healthCondition:   healthCondition || diagnosis || undefined,
      });
      externalPatientId = result.patientId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(422).json({ error: `Tenovi enrollment failed: ${msg}` });
    }
  } else {
    const apiKey = clinic.smartmeter_api_key as string | null;
    if (!apiKey) {
      return res.status(422).json({
        error: `Clinic "${clinic.name}" has no SmartMeter API key. Add it in Clinic Settings.`,
      });
    }
    try {
      const result = await enrollSmartMeterPatient(apiKey, {
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        dob:       dob || "",
        sex:       (sex as "M" | "F") || "M",
        phone:     phone || undefined,
        insurance: insurance || undefined,
        diagnosis: diagnosis || undefined,
        language:  language || undefined,
      });
      externalPatientId = result.patientId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(422).json({ error: `SmartMeter enrollment failed: ${msg}` });
    }
  }

  const patient = await createPatient({
    clinicId:         clinic.id,
    source:           rpmSource as "tenovi" | "smartmeter",
    externalPatientId,
    fullName,
    dob:              dob || undefined,
    sex:              sex || undefined,
    phone:            phone || undefined,
    language:         language || undefined,
    program:          program as "RPM" | "RTM" | "CCM" | "PCM",
    diagnoses,
    insurancePayer:   insurance || undefined,
  });

  return res.status(201).json({ patient });
}
