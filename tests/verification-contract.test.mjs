import test from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_SOVEREIGN, evaluateVerificationContract } from "../scripts/verification-contract.mjs";

function entries(style = "completion") {
  return CANONICAL_SOVEREIGN.map((subsystem, index) => {
    const sha = String(index + 1).padStart(40, "a").slice(-40);
    const objectSha = String(index + 1).padStart(64, "b").slice(-64);
    const repository = subsystem === "AUCTORISEAL_V010" ? "Verifrax/AUCTORISEAL" : "Verifrax/VERIFRAX-WWW";
    const path = subsystem === "AUCTORISEAL_V010" ? "public-control/auctoriseal-v010/closure.json" : `data/${subsystem.toLowerCase().replaceAll("_", "-")}/public-control-closure.json`;
    const base = {
      ordinal: index + 1,
      subsystem,
      state: `${subsystem}_PUBLIC_CONTROL_CLOSURE`,
      closed: true,
      public_control_closure_sha: sha,
      public_control_closure_sha_semantics: "git_commit_sha1_scoped_by_source_repository",
      closure_commit_signature_verified: true,
      closure_object_sha256: objectSha
    };
    if (style === "projected") {
      return {
        ...base,
        public_control_closure_repository: repository,
        public_control_closure_path: path
      };
    }
    return {
      ...base,
      source_repository: repository,
      source_path: path
    };
  });
}

function validFixture() {
  const completionEntries = entries("completion");
  const projectedEntries = entries("projected");
  const support = [{ subsystem: "ADMISSORIUM_V020", excluded_from_sovereign_completion_count: true }];
  return {
    finality: { state: "VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN", system_complete: false, summary: { cross_failures: 0, failed: 0 } },
    replay: { state: "VERIFRAX_PUBLIC_CONTROL_REPLAY_GREEN", system_complete: false, summary: { cross_failures: 0 } },
    receipt: { state: "VERIFRAX_PUBLIC_CONTROL_RECEIPT_GREEN", system_complete: false },
    perimeter: { state: "PUBLIC_PERIMETER_GREEN", system_complete: false, summary: { failed: 0 } },
    root: {
      system_complete: true,
      verifrax_system_complete: true,
      public_control_fixed_point: "https://status.verifrax.net/control-receipt/finality.json",
      public_control_fixed_point_state: "VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN",
      required_next_level: [],
      forbidden_claims: [],
      allowed_claims: ["VERIFRAX_SYSTEM_COMPLETE"],
      system_completion_gate_evaluation_decision: "PASS",
      system_completion_gate_evaluation_blocker: null,
      subsystem_closure_queue_decision: "COMPLETE",
      subsystem_closure_queue_blocker: null,
      subsystem_closure_queue_next_valid_action: "NO_NEXT_ACTION_VERIFRAX_SYSTEM_COMPLETE",
      next_subsystem_public_control_chain: null,
      external_control_verify_state: "NOT_ASSERTED_BY_ROOT_STATIC_CONTROL_OBJECT",
      external_control_verify_report_state: "NOT_ASSERTED_BY_ROOT_STATIC_CONTROL_OBJECT",
      global_status_board_system_complete: true,
      subsystem_closure_registry_system_complete: true,
      global_status_board_closed_subsystems: [...CANONICAL_SOVEREIGN],
      subsystem_closure_registry_registered_closed_subsystems: [...CANONICAL_SOVEREIGN]
    },
    rootData: {
      system_complete: true,
      verifrax_system_complete: true,
      public_control_fixed_point: "https://status.verifrax.net/control-receipt/finality.json",
      public_control_fixed_point_state: "VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN"
    },
    completion: {
      object_type: "VERIFRAX_SYSTEM_COMPLETION_CLOSURE",
      system_complete: true,
      verifrax_system_complete: true,
      completion_closure_authorized: true,
      completion_closure_published: true,
      gate_result: "PASS",
      gate_pass: true,
      required_subsystem_count: 9,
      closed_subsystem_count: 9,
      unique_scoped_closure_commit_count: 9,
      required_subsystems: [...CANONICAL_SOVEREIGN],
      blockers: [],
      external_replay_boundary: "VERIFRAX_EXTERNAL_CONTROL_VERIFY_GREEN_DOES_NOT_CREATE_VERIFRAX_SYSTEM_COMPLETE",
      original_completion_authority: {
        original_authority_pr: 186,
        original_authority_merge_sha: "fcb004f10299e9557e128f72310d63cdb4d2d2a3",
        original_authority_reviewer: "verifrax-systems",
        original_completion_authorization_preserved: true,
        repair_does_not_reissue_completion_authority: true
      },
      subsystem_results: completionEntries,
      support_closures: support
    },
    integrity: {
      object_type: "VERIFRAX_SYSTEM_COMPLETION_INTEGRITY_MANIFEST",
      system_complete: true,
      verifrax_system_complete: true,
      required_sovereign_subsystem_count: 9,
      closed_sovereign_subsystem_count: 9,
      unique_scoped_closure_commit_count: 9,
      required_sovereign_subsystems: [...CANONICAL_SOVEREIGN],
      authority: {
        original_authority_pr: 186,
        original_authority_merge_sha: "fcb004f10299e9557e128f72310d63cdb4d2d2a3",
        original_authority_reviewer: "verifrax-systems",
        original_completion_authorization_preserved: true,
        repair_does_not_reissue_completion_authority: true
      },
      invariants: {
        system_completion_authority_not_issued_by_external_replay: true,
        external_replay_may_verify_completion_provenance_but_cannot_create_it: true,
        all_required_sovereign_subsystems_present: true,
        all_required_sovereign_subsystems_closed: true,
        all_source_commits_signature_verified: true,
        all_closure_commit_references_repository_scoped: true,
        no_duplicate_scoped_closure_commit_references: true
      },
      sovereign_closures: completionEntries,
      support_closures: support
    },
    board: {
      system_complete: true,
      next_valid_action: "NO_NEXT_ACTION_VERIFRAX_SYSTEM_COMPLETE",
      closed_subsystems: [...CANONICAL_SOVEREIGN],
      registered_public_control_closures: projectedEntries
    },
    registry: { registered_public_control_closures: projectedEntries },
    rawHashes: { root: "same", rootData: "same" }
  };
}

test("authorized completion provenance passes without external authority overclaim", () => {
  const result = evaluateVerificationContract(validFixture());
  assert.deepEqual(result.failures, []);
  assert.equal(result.observedSystemComplete, true);
  assert.equal(result.completionProvenanceValid, true);
  assert.equal(result.provesSystemCompletion, false);
  assert.equal(result.completionAuthority, false);
});

test("external replay green cannot manufacture completion", () => {
  const fixture = validFixture();
  fixture.root.system_complete = false;
  fixture.root.verifrax_system_complete = false;
  fixture.rootData.system_complete = false;
  fixture.rootData.verifrax_system_complete = false;
  fixture.completion.system_complete = false;
  fixture.integrity.system_complete = false;
  const result = evaluateVerificationContract(fixture);
  assert.equal(result.observedSystemComplete, false);
  assert.equal(result.completionProvenanceValid, null);
  assert.equal(result.provesSystemCompletion, false);
  assert.equal(result.completionAuthority, false);
});

test("root completion claim fails if original authority provenance is missing", () => {
  const fixture = validFixture();
  fixture.completion.original_completion_authority.original_authority_pr = 999;
  const result = evaluateVerificationContract(fixture);
  assert.ok(result.failures.includes("completion_original_authority_pr"));
  assert.equal(result.completionProvenanceValid, false);
});

test("duplicate repository-scoped closure mapping fails", () => {
  const fixture = validFixture();
  fixture.completion.subsystem_results[1].public_control_closure_sha = fixture.completion.subsystem_results[0].public_control_closure_sha;
  fixture.integrity.sovereign_closures[1].public_control_closure_sha = fixture.integrity.sovereign_closures[0].public_control_closure_sha;
  const result = evaluateVerificationContract(fixture);
  assert.ok(result.failures.includes("completion_scoped_closure_keys_not_unique"));
});

test("ADMISSORIUM cannot enter sovereign completion projection", () => {
  const fixture = validFixture();
  fixture.board.closed_subsystems = [...CANONICAL_SOVEREIGN.slice(0, 8), "ADMISSORIUM_V020"];
  const result = evaluateVerificationContract(fixture);
  assert.ok(result.failures.includes("board_closed_set"));
});
