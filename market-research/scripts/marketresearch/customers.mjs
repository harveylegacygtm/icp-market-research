#!/usr/bin/env node
// Launchpad customer-list parser for the 06-market-research skill. Reads a won-
// customer CSV, maps the columns to the customer fields (company, domain, job
// title, company LinkedIn, company news), reports how many cells are already
// filled vs blank, and emits a normalized research worklist Claude enriches row
// by row. Zero dependencies, plain Node 18+. It never calls an API and never
// researches on its own; it only parses and normalizes so the model knows
// exactly what to go find.
//
// NOTE: the user's own ICP, service offering, and price point are NOT columns in
// this CSV. They are the user's input, collected once as the comparison baseline.
// This parser only handles the customer rows.
//
// Usage:
//   node customers.mjs customers.csv                  (summary + fill report + preview)
//   node customers.mjs customers.csv --json work.json (write normalized rows for enrichment)
//   node customers.mjs customers.csv --out clean.csv  (write the normalized canonical CSV)

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
if (!file) {
  console.error("Usage: node customers.mjs <customers.csv> [--json work.json] [--out clean.csv]");
  process.exit(1);
}

// ---- minimal RFC4180 CSV parser (handles quotes, commas, newlines in cells) ----
function parseCSV(text) {
  const rows = []; let row = [], cur = "", inQ = false, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i += 2; continue; } inQ = false; i++; continue; }
      cur += ch; i++; continue;
    }
    if (ch === '"') { inQ = true; i++; continue; }
    if (ch === ",") { row.push(cur); cur = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; i++; continue; }
    cur += ch; i++;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const csvCell = (s) => (/[",\n]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));

// ---- the standard fields and the header names that map to each ----
// key = canonical field, value = accepted header names (normalized: lowercase,
// alphanumerics only). First matching header in the file wins.
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const FIELDS = {
  companyName:     ["companyname", "company", "account", "accountname", "organization", "org", "name"],
  domain:          ["domain", "website", "url", "companydomain", "site", "web", "companywebsite"],
  jobTitle:        ["jobtitle", "title", "role", "position", "jobrole", "contacttitle"],
  companyLinkedin: ["companylinkedin", "linkedin", "linkedinurl", "companyli", "liurl", "linkedincompany", "companylinkedinurl"],
  companyNews:     ["companynews", "news", "recentnews", "trigger", "signal", "triggers", "signals"],
};
// the fields the model must fill in per row when a cell is blank. Firmographics
// and trigger tags are always researched by Claude (they are not CSV columns).
const RESEARCH_FIELDS = ["companyNews"];
const LABEL = {
  companyName: "Company", domain: "Domain", jobTitle: "Job title",
  companyLinkedin: "Company LinkedIn", companyNews: "Company News",
};

// ---- read + map columns ----
const rows = parseCSV(readFileSync(file, "utf8"));
if (rows.length < 2) { console.error("CSV has no data rows."); process.exit(1); }
const header = rows[0].map((h) => h.trim());
const normHeader = header.map(norm);
const data = rows.slice(1).filter((r) => r.some((c) => c && c.trim()));

const colOf = {}; // canonical field -> column index (or -1)
const usedCols = new Set();
for (const [field, names] of Object.entries(FIELDS)) {
  let idx = -1;
  for (const n of names) { const c = normHeader.indexOf(n); if (c >= 0) { idx = c; break; } }
  colOf[field] = idx;
  if (idx >= 0) usedCols.add(idx);
}
const extraCols = header.map((h, c) => c).filter((c) => !usedCols.has(c) && header[c].trim());

const get = (r, field) => { const c = colOf[field]; return c >= 0 ? (r[c] || "").trim() : ""; };

// ---- build normalized rows ----
const records = data.map((r, ri) => {
  const rec = { rowNum: ri + 2 };
  for (const field of Object.keys(FIELDS)) rec[field] = get(r, field);
  rec._extra = {};
  for (const c of extraCols) if ((r[c] || "").trim()) rec._extra[header[c]] = r[c].trim();
  rec._needsResearch = RESEARCH_FIELDS.filter((f) => !rec[f]);
  return rec;
});

// ---- summary ----
console.log(`\nCustomer list: ${file}`);
console.log(`Rows: ${records.length}\n`);

console.log("Column mapping:");
for (const field of Object.keys(FIELDS)) {
  const c = colOf[field];
  console.log(`  ${LABEL[field].padEnd(22)} ${c >= 0 ? `<- "${header[c]}"` : "(not in file, will research)"}`);
}
if (extraCols.length) console.log(`  Extra columns carried:  ${extraCols.map((c) => header[c]).join(", ")}`);

console.log("\nFill report (filled / blank):");
for (const field of Object.keys(FIELDS)) {
  const filled = records.filter((r) => r[field]).length;
  const blank = records.length - filled;
  const flag = RESEARCH_FIELDS.includes(field) && blank ? `  -> research ${blank}` : "";
  console.log(`  ${LABEL[field].padEnd(22)} ${String(filled).padStart(4)} / ${String(blank).padStart(4)}${flag}`);
}

const totalToResearch = records.reduce((s, r) => s + r._needsResearch.length, 0);
console.log(`\nResearch tasks: ${totalToResearch} Company News cell(s) to fill, plus firmographics + trigger tags for every row.`);
console.log("Baseline: collect the user's OWN ICP, service offering, and price point separately. Those are not in this CSV.");
if (records.length > 40) {
  console.log(`NOTE: ${records.length} rows is a big list. Ask the user whether to research every row or a representative sample before enriching.`);
}

console.log("\nPreview (first 5 rows):");
for (const rec of records.slice(0, 5)) {
  const id = rec.companyName || rec.domain || `row ${rec.rowNum}`;
  const need = rec._needsResearch.length ? `needs: ${rec._needsResearch.map((f) => LABEL[f]).join(", ")}` : "complete";
  console.log(`  ${String(rec.rowNum).padEnd(5)} ${id.slice(0, 32).padEnd(34)} ${need}`);
}
if (records.length > 5) console.log(`  ...and ${records.length - 5} more`);

// ---- optional: JSON worklist for enrichment ----
const jsonPath = argVal("--json");
if (jsonPath) {
  const out = {
    source: file,
    rows: records.length,
    researchFields: RESEARCH_FIELDS.map((f) => LABEL[f]),
    records,
  };
  writeFileSync(jsonPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${jsonPath} (normalized rows + per-row research worklist).`);
}

// ---- optional: normalized canonical CSV ----
const outPath = argVal("--out");
if (outPath) {
  const cols = Object.keys(FIELDS);
  const head = cols.map((f) => LABEL[f]).map(csvCell).join(",");
  const body = records.map((r) => cols.map((f) => csvCell(r[f] || "")).join(","));
  writeFileSync(outPath, [head, ...body].join("\n") + "\n");
  console.log(`Wrote ${outPath} (normalized canonical columns).`);
}
console.log("");
