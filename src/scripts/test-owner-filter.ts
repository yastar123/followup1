import { normalizeOwner, isMatchSales } from "../lib/utils";

interface MockCustomer {
  id: string;
  name: string;
  owner: string;
}

// Generate realistic mock dataset matching VPS distribution
// 7451 Topan, 7451 Fikram, 7451 Dayat, 7450 Rafli, 761 Rio = 30.564 total
function generateMockDataset(): MockCustomer[] {
  const rows: MockCustomer[] = [];
  let id = 1;

  for (let i = 0; i < 7451; i++) {
    rows.push({ id: `c_${id++}`, name: `Customer Topan ${i}`, owner: "Sales · Topan" });
  }
  for (let i = 0; i < 7451; i++) {
    rows.push({ id: `c_${id++}`, name: `Customer Fikram ${i}`, owner: "Sales · Fikram" });
  }
  for (let i = 0; i < 7451; i++) {
    rows.push({ id: `c_${id++}`, name: `Customer Dayat ${i}`, owner: "Sales · Dayat" });
  }
  for (let i = 0; i < 7450; i++) {
    rows.push({ id: `c_${id++}`, name: `Customer Rafli ${i}`, owner: "Sales · Rafli" });
  }
  for (let i = 0; i < 761; i++) {
    rows.push({ id: `c_${id++}`, name: `Customer Rio ${i}`, owner: "Sales · Rio" });
  }
  return rows;
}

function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING STRICT OWNER NORMALIZATION & FILTERING");
  console.log("=================================================\n");

  const dataset = generateMockDataset();
  console.log(`📊 Total dataset generated: ${dataset.length} baris.`);

  let allPassed = true;

  // TEST (a): Sales "Rio" (session.name = "Rio") melihat tepat 761 baris
  const rioRows = dataset.filter((c) => isMatchSales(c.owner, "Rio"));
  const passA = rioRows.length === 761;
  console.log(`Test (a): Sales "Rio" melihat tepat 761 baris?`);
  console.log(`   Hasil: ${rioRows.length} baris -> ${passA ? "✅ PASS" : "❌ FAIL"}`);
  if (!passA) allPassed = false;

  // TEST (b): Sales "Rio" dan "Mario" tidak saling melihat data
  // Buat mock data tambahan khusus Mario
  const marioCustomer: MockCustomer = { id: "m_1", name: "Budi Mario", owner: "Sales · Mario" };
  const rioCustomer: MockCustomer = { id: "r_1", name: "Andi Rio", owner: "Sales · Rio" };

  const marioSeesRio = isMatchSales(rioCustomer.owner, "Mario");
  const rioSeesMario = isMatchSales(marioCustomer.owner, "Rio");
  const passB = !marioSeesRio && !rioSeesMario;
  console.log(`\nTest (b): Sales "Rio" dan "Mario" tidak saling melihat data?`);
  console.log(`   Mario melihat Rio: ${marioSeesRio} (harus false)`);
  console.log(`   Rio melihat Mario: ${rioSeesMario} (harus false)`);
  console.log(`   Status -> ${passB ? "✅ PASS" : "❌ FAIL"}`);
  if (!passB) allPassed = false;

  // TEST (c): Customer berformat "Rio" polos dan "Sales · Rio" sama-sama dikenali milik Rio
  const custPlainRio: MockCustomer = { id: "c_plain", name: "Test Plain", owner: "Rio" };
  const custPrefixRio: MockCustomer = { id: "c_prefix", name: "Test Prefix", owner: "Sales · Rio" };
  const custSpacedRio: MockCustomer = {
    id: "c_spaced",
    name: "Test Spaced",
    owner: "Sales  ·  rio",
  };

  const matchPlain = isMatchSales(custPlainRio.owner, "Rio");
  const matchPrefix = isMatchSales(custPrefixRio.owner, "Rio");
  const matchSpaced = isMatchSales(custSpacedRio.owner, "Rio");
  const matchWithSessionPrefix = isMatchSales(custPlainRio.owner, "Sales · Rio");

  const passC = matchPlain && matchPrefix && matchSpaced && matchWithSessionPrefix;
  console.log(`\nTest (c): Format polos "Rio" dan "Sales · Rio" sama-sama dikenali milik Rio?`);
  console.log(`   Owner "Rio" vs Session "Rio": ${matchPlain}`);
  console.log(`   Owner "Sales · Rio" vs Session "Rio": ${matchPrefix}`);
  console.log(`   Owner "Sales  ·  rio" vs Session "Rio": ${matchSpaced}`);
  console.log(`   Owner "Rio" vs Session "Sales · Rio": ${matchWithSessionPrefix}`);
  console.log(`   Status -> ${passC ? "✅ PASS" : "❌ FAIL"}`);
  if (!passC) allPassed = false;

  // TEST (d): Admin melihat semua 30.564 baris
  const adminRows = dataset.filter((c) => isMatchSales(c.owner, "all"));
  const passD = adminRows.length === 30564;
  console.log(`\nTest (d): Admin melihat semua data?`);
  console.log(`   Hasil: ${adminRows.length} dari 30564 -> ${passD ? "✅ PASS" : "❌ FAIL"}`);
  if (!passD) allPassed = false;

  // TEST (e): "Belum ditugaskan" tidak pernah bocor ke sales
  const unassignedCustomer: MockCustomer = {
    id: "u_1",
    name: "Unassigned",
    owner: "Belum ditugaskan",
  };
  const emptyCustomer: MockCustomer = { id: "u_2", name: "Empty", owner: "" };
  const unassignedMatchRio = isMatchSales(unassignedCustomer.owner, "Rio");
  const emptyMatchRio = isMatchSales(emptyCustomer.owner, "Rio");
  const passE = !unassignedMatchRio && !emptyMatchRio;
  console.log(`\nTest (e): Data "Belum ditugaskan" atau kosong tidak bocor ke sales Rio?`);
  console.log(`   "Belum ditugaskan" cocok ke Rio: ${unassignedMatchRio} (harus false)`);
  console.log(`   "" (kosong) cocok ke Rio: ${emptyMatchRio} (harus false)`);
  console.log(`   Status -> ${passE ? "✅ PASS" : "❌ FAIL"}`);
  if (!passE) allPassed = false;

  console.log("\n=================================================");
  if (allPassed) {
    console.log("🎉 SEMUA PENGUJIAN FILTER OWNER BERHASIL (100% PASS)!");
  } else {
    console.error("❌ ADA PENGUJIAN YANG GAGAL!");
    process.exit(1);
  }
}

runTests();
