import fs from "node:fs/promises";
import crypto from "node:crypto";

const strict = process.argv.includes("--strict");
const now = new Date().toISOString();

const targets = [
  {
    id: "finality",
    url: "https://status.verifrax.net/control-receipt/finality.json",
    json: true,
    required: [
      "VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN",
      "VERIFRAX_PUBLIC_CONTROL_REPLAY_GREEN",
      "VERIFRAX_PUBLIC_CONTROL_RECEIPT_GREEN",
      "PUBLIC_PERIMETER_GREEN",
      "SYSTEM_CONTROL_MAP_OPEN"
    ]
  },
  {
    id: "finality_page",
    url: "https://status.verifrax.net/control-receipt/finality.html",
    required: ["VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN", "System complete"]
  },
  {
    id: "replay",
    url: "https://status.verifrax.net/control-receipt/replay.json",
    json: true,
    required: ["VERIFRAX_PUBLIC_CONTROL_REPLAY_GREEN", "VERIFRAX_PUBLIC_CONTROL_RECEIPT_GREEN", "PUBLIC_PERIMETER_GREEN"]
  },
  {
    id: "receipt",
    url: "https://status.verifrax.net/control-receipt/receipt.json",
    json: true,
    required: ["VERIFRAX_PUBLIC_CONTROL_RECEIPT_GREEN", "PUBLIC_PERIMETER_GREEN", "SYSTEM_CONTROL_MAP_OPEN"]
  },
  {
    id: "perimeter",
    url: "https://status.verifrax.net/perimeter/status.json",
    json: true,
    required: ["PUBLIC_PERIMETER_GREEN", "SYSTEM_CONTROL_MAP_OPEN"]
  },
  {
    id: "root_control",
    url: "https://www.verifrax.net/system-control.json",
    json: true,
    required: [
      "VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN",
      "VERIFRAX_PUBLIC_CONTROL_REPLAY_GREEN",
      "VERIFRAX_PUBLIC_CONTROL_RECEIPT_GREEN",
      "PUBLIC_PERIMETER_GREEN",
      "status.verifrax.net/control-receipt/finality.json"
    ]
  },
  {
    id: "root_data_control",
    url: "https://www.verifrax.net/data/verifrax-system-control.json",
    json: true,
    required: ["VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN", "status.verifrax.net/control-receipt/finality.json"]
  },
  {
    id: "root_page",
    url: "https://www.verifrax.net/system/",
    required: ["VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN", "status.verifrax.net/control-receipt/finality"]
  },
  {
    id: "apply_boundary",
    url: "https://apply.verifrax.net/",
    required: ["Terminal intake control plane", "does not publish proof", "recognize terminal truth", "assign recourse"]
  }
];

async function fetchText(target) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${target.url}${target.url.includes("?") ? "&" : "?"}external_verify=${Date.now()}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "user-agent": "VERIFRAX external public control verifier"
      }
    });

    const body = await response.text();
    const sha256 = crypto.createHash("sha256").update(body).digest("hex");
    const missing = target.required.filter(token => !body.includes(token));

    let parsed = null;
    const errors = [];
    if (target.json) {
      try {
        parsed = JSON.parse(body);
      } catch {
        errors.push("invalid_json");
      }
    }

    return {
      id: target.id,
      url: target.url,
      ok: response.status >= 200 && response.status < 400 && missing.length === 0 && errors.length === 0,
      http_status: response.status,
      elapsed_ms: Date.now() - started,
      sha256,
      missing,
      errors,
      parsed
    };
  } catch (error) {
    return {
      id: target.id,
      url: target.url,
      ok: false,
      http_status: 0,
      elapsed_ms: Date.now() - started,
      sha256: null,
      missing: target.required,
      errors: [String(error?.message || error)],
      parsed: null
    };
  } finally {
    clearTimeout(timer);
  }
}

const checks = [];
for (const target of targets) checks.push(await fetchText(target));

const byId = Object.fromEntries(checks.map(c => [c.id, c]));
const failures = [];

for (const check of checks) {
  if (!check.ok) failures.push(`${check.id}:probe_failed`);
}

const finality = byId.finality.parsed;
const replay = byId.replay.parsed;
const receipt = byId.receipt.parsed;
const perimeter = byId.perimeter.parsed;
const root = byId.root_control.parsed;
const rootData = byId.root_data_control.parsed;

function assert(name, condition) {
  if (!condition) failures.push(name);
}

assert("finality_state_bad", finality?.state === "VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN");
assert("finality_complete_not_false", finality?.system_complete === false);
assert("finality_cross_failures", finality?.summary?.cross_failures === 0);
assert("finality_failed_checks", finality?.summary?.failed === 0);

assert("replay_state_bad", replay?.state === "VERIFRAX_PUBLIC_CONTROL_REPLAY_GREEN");
assert("replay_complete_not_false", replay?.system_complete === false);
assert("replay_cross_failures", replay?.summary?.cross_failures === 0);

assert("receipt_state_bad", receipt?.state === "VERIFRAX_PUBLIC_CONTROL_RECEIPT_GREEN");
assert("receipt_complete_not_false", receipt?.system_complete === false);

assert("perimeter_state_bad", perimeter?.state === "PUBLIC_PERIMETER_GREEN");
assert("perimeter_complete_not_false", perimeter?.system_complete === false);
assert("perimeter_failed_hosts", perimeter?.summary?.failed === 0);

assert("root_fixed_point_pointer_bad", root?.public_control_fixed_point === "https://status.verifrax.net/control-receipt/finality.json");
assert("root_fixed_point_state_bad", root?.public_control_fixed_point_state === "VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN");
assert("root_complete_not_false", root?.system_complete === false);

assert("root_data_fixed_point_pointer_bad", rootData?.public_control_fixed_point === "https://status.verifrax.net/control-receipt/finality.json");
assert("root_data_fixed_point_state_bad", rootData?.public_control_fixed_point_state === "VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN");
assert("root_data_complete_not_false", rootData?.system_complete === false);

const report = {
  schema_version: "1.0.0",
  object_type: "VERIFRAX_EXTERNAL_PUBLIC_CONTROL_VERIFY_REPORT",
  generated_at: now,
  verifier_repo: "Verifrax/VERIFRAX-CONTROL-VERIFY",
  state: failures.length === 0 ? "VERIFRAX_EXTERNAL_CONTROL_VERIFY_GREEN" : "VERIFRAX_EXTERNAL_CONTROL_VERIFY_FAIL",
  system: "VERIFRAX",
  system_complete: false,
  fixed_point_state: finality?.state || null,
  replay_state: replay?.state || null,
  receipt_state: receipt?.state || null,
  perimeter_state: perimeter?.state || null,
  root_fixed_point_state: root?.public_control_fixed_point_state || null,
  strict,
  failures,
  summary: {
    total: checks.length,
    green: checks.filter(c => c.ok).length,
    failed: checks.filter(c => !c.ok).length,
    semantic_failures: failures.length
  },
  checks: checks.map(({ parsed, ...rest }) => rest)
};

await fs.mkdir("reports", { recursive: true });
await fs.writeFile("reports/public-control-verify.latest.json", JSON.stringify(report, null, 2) + "\n");

if (failures.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log("VERIFRAX_EXTERNAL_CONTROL_VERIFY_GREEN=true");
console.log(JSON.stringify(report.summary));
