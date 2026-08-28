import fs from "node:fs/promises";
import crypto from "node:crypto";
import { evaluateVerificationContract } from "./verification-contract.mjs";

const strict = process.argv.includes("--strict");
const now = new Date().toISOString();
const githubToken = process.env.GITHUB_TOKEN || "";

const targets = [
  {
    id: "finality",
    url: "https://status.verifrax.net/control-receipt/finality.json",
    json: true,
    required: ["VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN", "VERIFRAX_PUBLIC_CONTROL_REPLAY_GREEN", "VERIFRAX_PUBLIC_CONTROL_RECEIPT_GREEN", "PUBLIC_PERIMETER_GREEN"]
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
    required: ["VERIFRAX_PUBLIC_CONTROL_RECEIPT_GREEN", "PUBLIC_PERIMETER_GREEN"]
  },
  {
    id: "perimeter",
    url: "https://status.verifrax.net/perimeter/status.json",
    json: true,
    required: ["PUBLIC_PERIMETER_GREEN"]
  },
  {
    id: "root_control",
    url: "https://www.verifrax.net/system-control.json",
    json: true,
    required: ["VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN", "status.verifrax.net/control-receipt/finality.json"]
  },
  {
    id: "root_data_control",
    url: "https://www.verifrax.net/data/verifrax-system-control.json",
    json: true,
    required: ["VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN", "status.verifrax.net/control-receipt/finality.json"]
  },
  {
    id: "completion_closure",
    url: "https://www.verifrax.net/data/system-completion-closure.json",
    json: true,
    required: ["VERIFRAX_SYSTEM_COMPLETION_CLOSURE", "VERIFRAX_EXTERNAL_CONTROL_VERIFY_GREEN_DOES_NOT_CREATE_VERIFRAX_SYSTEM_COMPLETE"]
  },
  {
    id: "completion_integrity",
    url: "https://www.verifrax.net/data/system-completion-integrity.json",
    json: true,
    required: ["VERIFRAX_SYSTEM_COMPLETION_INTEGRITY_MANIFEST", "external_replay_may_verify_completion_provenance_but_cannot_create_it"]
  },
  {
    id: "global_status_board",
    url: "https://www.verifrax.net/data/global-status-board.json",
    json: true,
    required: ["VERIFRAX_GLOBAL_STATUS_BOARD_OPEN"]
  },
  {
    id: "subsystem_closure_registry",
    url: "https://www.verifrax.net/data/subsystem-closure-registry.json",
    json: true,
    required: ["SUBSYSTEM_CLOSURE_REGISTRY_NORMALIZED_FOR_SYSTEM_COMPLETION_GATE_AFTER_REGRESSORIUM_V010"]
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

function sha256(body) {
  return crypto.createHash("sha256").update(body).digest("hex");
}

async function fetchText(target) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const separator = target.url.includes("?") ? "&" : "?";
    const response = await fetch(`${target.url}${separator}external_verify=${Date.now()}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent": "VERIFRAX external public control verifier"
      }
    });

    const body = await response.text();
    const missing = (target.required || []).filter(token => !body.includes(token));
    const errors = [];
    let parsed = null;

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
      sha256: sha256(body),
      missing,
      errors,
      body,
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
      missing: target.required || [],
      errors: [String(error?.message || error)],
      body: "",
      parsed: null
    };
  } finally {
    clearTimeout(timer);
  }
}

async function verifySourceClosure(entry) {
  const result = {
    subsystem: entry?.subsystem ?? null,
    repository: entry?.source_repository ?? null,
    path: entry?.source_path ?? null,
    commit_sha: entry?.public_control_closure_sha ?? null,
    expected_object_sha256: entry?.closure_object_sha256 ?? null,
    raw_object_sha256: null,
    commit_signature_verified: false,
    ok: false,
    errors: []
  };

  try {
    if (!result.repository || !result.path || !/^[0-9a-f]{40}$/.test(result.commit_sha || "") || !/^[0-9a-f]{64}$/.test(result.expected_object_sha256 || "")) {
      result.errors.push("invalid_source_descriptor");
      return result;
    }

    const rawUrl = `https://raw.githubusercontent.com/${result.repository}/${result.commit_sha}/${result.path}`;
    const rawResponse = await fetch(rawUrl, {
      redirect: "follow",
      headers: { "user-agent": "VERIFRAX external public control verifier" }
    });
    if (!rawResponse.ok) {
      result.errors.push(`raw_http_${rawResponse.status}`);
      return result;
    }
    const rawBody = await rawResponse.text();
    result.raw_object_sha256 = sha256(rawBody);
    if (result.raw_object_sha256 !== result.expected_object_sha256) {
      result.errors.push("closure_object_sha256_mismatch");
    }

    const apiHeaders = {
      accept: "application/vnd.github+json",
      "user-agent": "VERIFRAX external public control verifier"
    };
    if (githubToken) apiHeaders.authorization = `Bearer ${githubToken}`;

    const commitResponse = await fetch(`https://api.github.com/repos/${result.repository}/commits/${result.commit_sha}`, {
      redirect: "follow",
      headers: apiHeaders
    });
    if (!commitResponse.ok) {
      result.errors.push(`commit_api_http_${commitResponse.status}`);
      return result;
    }
    const commit = await commitResponse.json();
    result.commit_signature_verified = commit?.commit?.verification?.verified === true;
    if (!result.commit_signature_verified) {
      result.errors.push(`commit_signature_${commit?.commit?.verification?.reason || "not_verified"}`);
    }

    result.ok = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors.push(String(error?.message || error));
    return result;
  }
}

const checks = [];
for (const target of targets) checks.push(await fetchText(target));
const byId = Object.fromEntries(checks.map(check => [check.id, check]));

const probeFailures = checks.filter(check => !check.ok).map(check => `${check.id}:probe_failed`);

const semantic = evaluateVerificationContract({
  finality: byId.finality?.parsed,
  replay: byId.replay?.parsed,
  receipt: byId.receipt?.parsed,
  perimeter: byId.perimeter?.parsed,
  root: byId.root_control?.parsed,
  rootData: byId.root_data_control?.parsed,
  completion: byId.completion_closure?.parsed,
  integrity: byId.completion_integrity?.parsed,
  board: byId.global_status_board?.parsed,
  registry: byId.subsystem_closure_registry?.parsed,
  rawHashes: {
    root: byId.root_control?.sha256,
    rootData: byId.root_data_control?.sha256
  }
});

const sourceChecks = [];
const sovereignClosures = byId.completion_integrity?.parsed?.sovereign_closures;
if (Array.isArray(sovereignClosures)) {
  for (const entry of sovereignClosures) sourceChecks.push(await verifySourceClosure(entry));
}

const sourceFailures = [];
if (byId.root_control?.parsed?.system_complete === true) {
  if (sourceChecks.length !== 9) sourceFailures.push("source_provenance_count_not_nine");
  for (const sourceCheck of sourceChecks) {
    if (!sourceCheck.ok) sourceFailures.push(`source_provenance:${sourceCheck.subsystem || "unknown"}`);
  }
}

const failures = [...probeFailures, ...semantic.failures, ...sourceFailures];
const completionProvenanceValid =
  semantic.observedSystemComplete === true
    ? semantic.completionProvenanceValid === true && sourceFailures.length === 0
    : null;

const report = {
  schema_version: "2.0.0",
  object_type: "VERIFRAX_EXTERNAL_PUBLIC_CONTROL_VERIFY_REPORT",
  generated_at: now,
  verifier_repo: "Verifrax/VERIFRAX-CONTROL-VERIFY",
  state: failures.length === 0 ? "VERIFRAX_EXTERNAL_CONTROL_VERIFY_GREEN" : "VERIFRAX_EXTERNAL_CONTROL_VERIFY_FAIL",
  system: "VERIFRAX",
  strict,
  observed_system_complete: semantic.observedSystemComplete,
  completion_provenance_valid: completionProvenanceValid,
  completion_provenance_state:
    semantic.observedSystemComplete === true
      ? completionProvenanceValid
        ? "AUTHORIZED_COMPLETION_PROVENANCE_VERIFIED"
        : "AUTHORIZED_COMPLETION_PROVENANCE_FAILED"
      : "SYSTEM_COMPLETION_NOT_OBSERVED",
  proves_system_completion: false,
  completion_authority: false,
  completion_authority_source: "VERIFRAX-WWW_AUTHORIZED_COMPLETION_CLOSURE_NOT_EXTERNAL_REPLAY",
  external_replay_boundary: "VERIFRAX_EXTERNAL_CONTROL_VERIFY_GREEN_DOES_NOT_CREATE_VERIFRAX_SYSTEM_COMPLETE",
  fixed_point_state: byId.finality?.parsed?.state || null,
  replay_state: byId.replay?.parsed?.state || null,
  receipt_state: byId.receipt?.parsed?.state || null,
  perimeter_state: byId.perimeter?.parsed?.state || null,
  root_fixed_point_state: byId.root_control?.parsed?.public_control_fixed_point_state || null,
  failures,
  summary: {
    target_total: checks.length,
    target_green: checks.filter(check => check.ok).length,
    target_failed: checks.filter(check => !check.ok).length,
    source_provenance_total: sourceChecks.length,
    source_provenance_green: sourceChecks.filter(check => check.ok).length,
    source_provenance_failed: sourceChecks.filter(check => !check.ok).length,
    replay_semantic_failures: semantic.replayFailures.length,
    completion_semantic_failures: semantic.completionFailures.length,
    total_failures: failures.length
  },
  checks: checks.map(({ parsed, body, ...check }) => check),
  source_provenance_checks: sourceChecks
};

await fs.mkdir("reports", { recursive: true });
await fs.writeFile("reports/public-control-verify.latest.json", JSON.stringify(report, null, 2) + "\n");

if (failures.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log("VERIFRAX_EXTERNAL_CONTROL_VERIFY_GREEN=true");
console.log(`OBSERVED_VERIFRAX_SYSTEM_COMPLETE=${String(report.observed_system_complete)}`);
console.log(`COMPLETION_PROVENANCE_VALID=${String(report.completion_provenance_valid)}`);
console.log("EXTERNAL_REPLAY_CREATES_SYSTEM_COMPLETION=false");
console.log(JSON.stringify(report.summary));
