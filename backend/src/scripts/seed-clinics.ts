/**
 * Upserts all 22 clinics with their SmartMeter API keys.
 * Run AFTER applying migration 0002:
 *   npx tsx src/scripts/seed-clinics.ts
 */
import "dotenv/config";
import { supabaseAdmin } from "../lib/supabase";

const CLINICS: { name: string; smartmeter_api_key: string }[] = [
  { name: "786 Medical PLLC",                         smartmeter_api_key: "bb300d03cdffaf310b59428362aee111f0c6d27b51010814a3560b314060b0fa" },
  { name: "Advanced Care and Wellness Center LLC",     smartmeter_api_key: "1e04be1ea121c2c18980d03553fbdd4e4e63ef28d2ac85a9362b355b239110cd" },
  { name: "Awesome Care Clinics",                      smartmeter_api_key: "e3a92c2daf909ccc1cd072c03c4e80b5f32b7b2bae02ef20f455c7ab227b522e" },
  { name: "Corpus Care Family Medicine",               smartmeter_api_key: "c3858de77e3de5e00dfc496a4b7c96464e8e69de0d6d53b80676924087d3ed73" },
  { name: "Dr. Balasubramanian",                       smartmeter_api_key: "ebd6201aaf7349850917213d26085bb6de1bfee0749dddf5c6cb0a3663a7b03a" },
  { name: "Dr. Jeremy Szeto",                          smartmeter_api_key: "bb6cf9acc86ff3c768a529ae69ca94a6eedb180da2bd9869feae7c22152c7ed9" },
  { name: "Dr. Noel Estillore",                        smartmeter_api_key: "b16d15d9efb00240ca2023a65e6d42b03324a9d5b3ae1034a162b7bd1ffa0d4f" },
  { name: "Dr. Russell Skinner",                       smartmeter_api_key: "ac245bb7cdf444f4981d9cf520a53a29d991a17edf731320f43640ade4d5f4bf" },
  { name: "Dr. Silat",                                 smartmeter_api_key: "9c53eaee3f0ad4e3bcc2faf6d720a6b3bfdc4787400818974c17c82c9776cfe9" },
  { name: "HMC ALF",                                   smartmeter_api_key: "2be5468026f1a9b03f51d0e06069061f5e7f04e233215c68822aa603e0f0d9aa" },
  { name: "Healthy Me Clinic PLLC",                   smartmeter_api_key: "5bfdbfd269148abed43ffd126d358cfe44479badeb2d3a186467a9e4e304c952" },
  { name: "Heartful Cardiology",                       smartmeter_api_key: "9a89373301cc1b8cfb25b32a6e0e759bb457de36d9d4449d06841210834de605" },
  { name: "Home Doctors",                              smartmeter_api_key: "04dd01a777e62c2e23533ca89d1db28720096620400f2b9b915933697cce9706" },
  { name: "MJMD Primary Care",                         smartmeter_api_key: "4eca48c8df2a686709babc8259c3de0763e068c15451a17df9b85788506f135d" },
  { name: "Premier Health Family Medicine",            smartmeter_api_key: "448dcc87b343646ff13f2729fd0f1678a9839ddfa4986bcaba39da7cf00bd51a" },
  { name: "PrimeCare TX PLLC",                        smartmeter_api_key: "1d83e57db04c1fb4cb62e0b0e4fb87e05766cfc9d304f89e0accfe01de51c7f2" },
  { name: "Priority Health System LLC",                smartmeter_api_key: "1016ab4baae2d2dc993f5963c0ffd853a3a30e1deaec95c07ad7c7d6fd7b9368" },
  { name: "Puso LLC",                                  smartmeter_api_key: "da635bcc3b61770218b6751e5a8fd65144184a819ad78de2e74e9eb2a0ca5051" },
  { name: "Quantum Care 24",                           smartmeter_api_key: "eda72abf4644b36f4d3ff585fb46203976bd047e97c98971a65abd24469f4481" },
  { name: "Siminibe Patrick Moneke",                   smartmeter_api_key: "04956b99a234bbcb73812a7635803c3134df8a97dfe0898f77bfebd03c659696" },
  { name: "Texan Primary Care",                        smartmeter_api_key: "2c3de50f19ae853ff2aeab88848bb15d0441caa362a39d1f5a28d77c118d3416" },
  { name: "Texas Heart and Vascular Institute",        smartmeter_api_key: "b598241b1382d065da1f90efc6580ecda848824f32c4c0992fed83e5841c37ab" },
];

async function run() {
  console.log(`Seeding ${CLINICS.length} clinics…`);
  for (const clinic of CLINICS) {
    const { data: existing } = await supabaseAdmin
      .from("clinics")
      .select("id")
      .eq("name", clinic.name)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("clinics")
        .update({ smartmeter_api_key: clinic.smartmeter_api_key })
        .eq("id", existing.id);
      console.log(error ? `  ✗ update  ${clinic.name}: ${error.message}` : `  ✓ updated  ${clinic.name}`);
    } else {
      const { error } = await supabaseAdmin
        .from("clinics")
        .insert({ name: clinic.name, smartmeter_api_key: clinic.smartmeter_api_key });
      console.log(error ? `  ✗ insert  ${clinic.name}: ${error.message}` : `  ✓ inserted ${clinic.name}`);
    }
  }
  console.log("Done.");
}

run().catch(console.error);
