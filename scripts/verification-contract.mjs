export const CANONICAL_SOVEREIGN = Object.freeze([
  "SYNTAGMARIUM_V010",
  "ORBISTIUM_V010",
  "CONSONORIUM_V010",
  "TACHYRIUM_V010",
  "AUCTORISEAL_V010",
  "CORPIFORM_V010",
  "VERIFRAX_V010",
  "ANAGNORIUM_V010",
  "REGRESSORIUM_V010"
]);

const ORIGINAL_AUTHORITY = Object.freeze({
  pr: 186,
  merge_sha: "fcb004f10299e9557e128f72310d63cdb4d2d2a3",
  reviewer: "verifrax-systems"
});

function sorted(values) {
  return [...values].sort();
}

function sameSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const left = sorted(a);
  const right = sorted(b);
  return left.every((value, index) => value === right[index]);
}

function push(failures, name, condition) {
  if (!condition) failures.push(name);
}

function normalizedCompletionEntry(entry) {
  return {
    subsystem: entry?.subsystem ?? null,
    state: entry?.state ?? null,
    closed: entry?.closed === true,
    repository: entry?.source_repository ?? null,
    path: entry?.source_path ?? null,
    sha: entry?.public_control_closure_sha ?? null,
    semantics: entry?.public_control_closure_sha_semantics ?? null,
    signatureVerified: entry?.closure_commit_signature_verified === true,
    objectSha256: entry?.closure_object_sha256 ?? null
  };
}

function normalizedProjectedEntry(entry) {
  return {
    subsystem: entry?.subsystem ?? null,
    state: entry?.state ?? null,
    closed: entry?.closed === true,
    repository: entry?.public_control_closure_repository ?? null,
    path: entry?.public_control_closure_path ?? null,
    sha: entry?.public_control_closure_sha ?? null,
    semantics: entry?.public_control_closure_sha_semantics ?? null,
    signatureVerified: entry?.closure_commit_signature_verified === true,
    objectSha256: entry?.closure_object_sha256 ?? null
  };
}

function indexBySubsystem(entries, normalizer) {
  const map = new Map();
  for (const raw of Array.isArray(entries) ? entries : []) {
    const entry = normalizer(raw);
    if (entry.subsystem) map.set(entry.subsystem, entry);
  }
  return map;
}

function compareProjectedMap(failures, prefix, canonicalMap, projectedEntries) {
  const projectedMap = indexBySubsystem(projectedEntries, normalizedProjectedEntry);
  push(failures, `${prefix}_subsystem_set`, sameSet([...projectedMap.keys()], CANONICAL_SOVEREIGN));

  for (const subsystem of CANONICAL_SOVEREIGN) {
    const canonical = canonicalMap.get(subsystem);
    const projected = projectedMap.get(subsystem);
    push(failures, `${prefix}_${subsystem}_present`, Boolean(projected));
    if (!canonical || !projected) continue;

    push(failures, `${prefix}_${subsystem}_state`, projected.state === canonical.state);
    push(failures, `${prefix}_${subsystem}_closed`, projected.closed === true);
    push(failures, `${prefix}_${subsystem}_repository`, projected.repository === canonical.repository);
    push(failures, `${prefix}_${subsystem}_path`, projected.path === canonical.path);
    push(failures, `${prefix}_${subsystem}_sha`, projected.sha === canonical.sha);
    push(failures, `${prefix}_${subsystem}_semantics`, projected.semantics === "git_commit_sha1_scoped_by_source_repository");
    push(failures, `${prefix}_${subsystem}_signature`, projected.signatureVerified === true);
    push(failures, `${prefix}_${subsystem}_object_sha256`, projected.objectSha256 === canonical.objectSha256);
  }
}

function validateReplay({ finality, replay, receipt, perimeter, root, rootData, rawHashes }) {
  const failures = [];

  push(failures, "finality_state_bad", finality?.state === "VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN");
  push(failures, "finality_must_not_claim_system_completion", finality?.system_complete === false);
  push(failures, "finality_cross_failures", finality?.summary?.cross_failures === 0);
  push(failures, "finality_failed_checks", finality?.summary?.failed === 0);

  push(failures, "replay_state_bad", replay?.state === "VERIFRAX_PUBLIC_CONTROL_REPLAY_GREEN");
  push(failures, "replay_must_not_claim_system_completion", replay?.system_complete === false);
  push(failures, "replay_cross_failures", replay?.summary?.cross_failures === 0);

  push(failures, "receipt_state_bad", receipt?.state === "VERIFRAX_PUBLIC_CONTROL_RECEIPT_GREEN");
  push(failures, "receipt_must_not_claim_system_completion", receipt?.system_complete === false);

  push(failures, "perimeter_state_bad", perimeter?.state === "PUBLIC_PERIMETER_GREEN");
  push(failures, "perimeter_must_not_claim_system_completion", perimeter?.system_complete === false);
  push(failures, "perimeter_failed_hosts", perimeter?.summary?.failed === 0);

  push(failures, "root_fixed_point_pointer_bad", root?.public_control_fixed_point === "https://status.verifrax.net/control-receipt/finality.json");
  push(failures, "root_fixed_point_state_bad", root?.public_control_fixed_point_state === "VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN");
  push(failures, "root_data_fixed_point_pointer_bad", rootData?.public_control_fixed_point === "https://status.verifrax.net/control-receipt/finality.json");
  push(failures, "root_data_fixed_point_state_bad", rootData?.public_control_fixed_point_state === "VERIFRAX_PUBLIC_CONTROL_FIXED_POINT_GREEN");
  push(failures, "root_completion_projection_copy_mismatch", root?.system_complete === rootData?.system_complete);
  push(failures, "root_verifrax_completion_projection_copy_mismatch", root?.verifrax_system_complete === rootData?.verifrax_system_complete);
  push(failures, "root_control_byte_identity", rawHashes?.root && rawHashes?.root === rawHashes?.rootData);

  return failures;
}

function validateCompletion({ root, rootData, completion, integrity, board, registry }) {
  const failures = [];
  const observed = root?.system_complete;

  push(failures, "root_system_complete_not_boolean", typeof observed === "boolean");
  push(failures, "root_verifrax_system_complete_not_boolean", typeof root?.verifrax_system_complete === "boolean");
  push(failures, "root_and_verifrax_completion_disagree", root?.system_complete === root?.verifrax_system_complete);
  push(failures, "root_data_completion_disagrees", rootData?.system_complete === root?.system_complete);

  if (observed !== true) {
    push(failures, "current_completion_object_disagrees_with_root_false", completion?.system_complete !== true);
    push(failures, "current_integrity_object_disagrees_with_root_false", integrity?.system_complete !== true);
    return failures;
  }

  push(failures, "root_required_next_level_not_empty", Array.isArray(root?.required_next_level) && root.required_next_level.length === 0);
  push(failures, "root_forbids_authorized_completion", !root?.forbidden_claims?.includes("VERIFRAX_SYSTEM_COMPLETE"));
  push(failures, "root_does_not_allow_authorized_completion", root?.allowed_claims?.includes("VERIFRAX_SYSTEM_COMPLETE"));
  push(failures, "root_gate_not_pass", root?.system_completion_gate_evaluation_decision === "PASS");
  push(failures, "root_gate_blocker_present", root?.system_completion_gate_evaluation_blocker == null);
  push(failures, "root_queue_not_complete", root?.subsystem_closure_queue_decision === "COMPLETE");
  push(failures, "root_queue_blocker_present", root?.subsystem_closure_queue_blocker == null);
  push(failures, "root_queue_next_action_bad", root?.subsystem_closure_queue_next_valid_action === "NO_NEXT_ACTION_VERIFRAX_SYSTEM_COMPLETE");
  push(failures, "root_next_subsystem_not_null", root?.next_subsystem_public_control_chain == null);
  push(failures, "root_static_external_verify_overclaim", root?.external_control_verify_state === "NOT_ASSERTED_BY_ROOT_STATIC_CONTROL_OBJECT");
  push(failures, "root_static_external_report_overclaim", root?.external_control_verify_report_state === "NOT_ASSERTED_BY_ROOT_STATIC_CONTROL_OBJECT");
  push(failures, "root_global_board_not_complete", root?.global_status_board_system_complete === true);
  push(failures, "root_registry_not_complete", root?.subsystem_closure_registry_system_complete === true);
  push(failures, "root_global_board_set", sameSet(root?.global_status_board_closed_subsystems, CANONICAL_SOVEREIGN));
  push(failures, "root_registry_set", sameSet(root?.subsystem_closure_registry_registered_closed_subsystems, CANONICAL_SOVEREIGN));

  push(failures, "completion_object_type", completion?.object_type === "VERIFRAX_SYSTEM_COMPLETION_CLOSURE");
  push(failures, "completion_system_complete", completion?.system_complete === true && completion?.verifrax_system_complete === true);
  push(failures, "completion_authorized", completion?.completion_closure_authorized === true);
  push(failures, "completion_published", completion?.completion_closure_published === true);
  push(failures, "completion_gate", completion?.gate_result === "PASS" && completion?.gate_pass === true);
  push(failures, "completion_required_count", completion?.required_subsystem_count === 9);
  push(failures, "completion_closed_count", completion?.closed_subsystem_count === 9);
  push(failures, "completion_unique_scoped_count", completion?.unique_scoped_closure_commit_count === 9);
  push(failures, "completion_required_set", sameSet(completion?.required_subsystems, CANONICAL_SOVEREIGN));
  push(failures, "completion_blockers", Array.isArray(completion?.blockers) && completion.blockers.length === 0);
  push(failures, "completion_external_replay_boundary", completion?.external_replay_boundary === "VERIFRAX_EXTERNAL_CONTROL_VERIFY_GREEN_DOES_NOT_CREATE_VERIFRAX_SYSTEM_COMPLETE");
  push(failures, "completion_original_authority_pr", completion?.original_completion_authority?.original_authority_pr === ORIGINAL_AUTHORITY.pr);
  push(failures, "completion_original_authority_merge", completion?.original_completion_authority?.original_authority_merge_sha === ORIGINAL_AUTHORITY.merge_sha);
  push(failures, "completion_original_authority_reviewer", completion?.original_completion_authority?.original_authority_reviewer === ORIGINAL_AUTHORITY.reviewer);
  push(failures, "completion_original_authority_preserved", completion?.original_completion_authority?.original_completion_authorization_preserved === true);
  push(failures, "completion_repair_does_not_reissue", completion?.original_completion_authority?.repair_does_not_reissue_completion_authority === true);

  push(failures, "integrity_object_type", integrity?.object_type === "VERIFRAX_SYSTEM_COMPLETION_INTEGRITY_MANIFEST");
  push(failures, "integrity_system_complete", integrity?.system_complete === true && integrity?.verifrax_system_complete === true);
  push(failures, "integrity_required_count", integrity?.required_sovereign_subsystem_count === 9);
  push(failures, "integrity_closed_count", integrity?.closed_sovereign_subsystem_count === 9);
  push(failures, "integrity_unique_scoped_count", integrity?.unique_scoped_closure_commit_count === 9);
  push(failures, "integrity_required_set", sameSet(integrity?.required_sovereign_subsystems, CANONICAL_SOVEREIGN));
  push(failures, "integrity_authority_pr", integrity?.authority?.original_authority_pr === ORIGINAL_AUTHORITY.pr);
  push(failures, "integrity_authority_merge", integrity?.authority?.original_authority_merge_sha === ORIGINAL_AUTHORITY.merge_sha);
  push(failures, "integrity_authority_reviewer", integrity?.authority?.original_authority_reviewer === ORIGINAL_AUTHORITY.reviewer);
  push(failures, "integrity_authority_preserved", integrity?.authority?.original_completion_authorization_preserved === true);
  push(failures, "integrity_repair_does_not_reissue", integrity?.authority?.repair_does_not_reissue_completion_authority === true);
  push(failures, "integrity_external_replay_non_authority", integrity?.invariants?.system_completion_authority_not_issued_by_external_replay === true);
  push(failures, "integrity_external_replay_provenance_only", integrity?.invariants?.external_replay_may_verify_completion_provenance_but_cannot_create_it === true);
  push(failures, "integrity_all_present", integrity?.invariants?.all_required_sovereign_subsystems_present === true);
  push(failures, "integrity_all_closed", integrity?.invariants?.all_required_sovereign_subsystems_closed === true);
  push(failures, "integrity_all_signatures", integrity?.invariants?.all_source_commits_signature_verified === true);
  push(failures, "integrity_repository_scope", integrity?.invariants?.all_closure_commit_references_repository_scoped === true);
  push(failures, "integrity_no_aliases", integrity?.invariants?.no_duplicate_scoped_closure_commit_references === true);

  const completionMap = indexBySubsystem(completion?.subsystem_results, normalizedCompletionEntry);
  const integrityMap = indexBySubsystem(integrity?.sovereign_closures, normalizedCompletionEntry);
  push(failures, "completion_results_set", sameSet([...completionMap.keys()], CANONICAL_SOVEREIGN));
  push(failures, "integrity_closures_set", sameSet([...integrityMap.keys()], CANONICAL_SOVEREIGN));

  const scopedKeys = [];
  for (const subsystem of CANONICAL_SOVEREIGN) {
    const completionEntry = completionMap.get(subsystem);
    const integrityEntry = integrityMap.get(subsystem);
    push(failures, `completion_${subsystem}_present`, Boolean(completionEntry));
    push(failures, `integrity_${subsystem}_present`, Boolean(integrityEntry));
    if (!completionEntry || !integrityEntry) continue;

    push(failures, `completion_${subsystem}_state_name`, completionEntry.state === `${subsystem}_PUBLIC_CONTROL_CLOSURE`);
    push(failures, `completion_${subsystem}_closed`, completionEntry.closed === true);
    push(failures, `completion_${subsystem}_repository`, Boolean(completionEntry.repository));
    push(failures, `completion_${subsystem}_path`, Boolean(completionEntry.path));
    push(failures, `completion_${subsystem}_sha`, /^[0-9a-f]{40}$/.test(completionEntry.sha ?? ""));
    push(failures, `completion_${subsystem}_semantics`, completionEntry.semantics === "git_commit_sha1_scoped_by_source_repository");
    push(failures, `completion_${subsystem}_signature`, completionEntry.signatureVerified === true);
    push(failures, `completion_${subsystem}_object_sha256`, /^[0-9a-f]{64}$/.test(completionEntry.objectSha256 ?? ""));

    push(failures, `integrity_${subsystem}_state`, integrityEntry.state === completionEntry.state);
    push(failures, `integrity_${subsystem}_repository`, integrityEntry.repository === completionEntry.repository);
    push(failures, `integrity_${subsystem}_path`, integrityEntry.path === completionEntry.path);
    push(failures, `integrity_${subsystem}_sha`, integrityEntry.sha === completionEntry.sha);
    push(failures, `integrity_${subsystem}_object_sha256`, integrityEntry.objectSha256 === completionEntry.objectSha256);

    scopedKeys.push(`${completionEntry.repository}#${completionEntry.sha}`);
  }
  push(failures, "completion_scoped_closure_keys_not_unique", new Set(scopedKeys).size === 9);

  const completionSupport = Array.isArray(completion?.support_closures) ? completion.support_closures : [];
  const integritySupport = Array.isArray(integrity?.support_closures) ? integrity.support_closures : [];
  push(failures, "completion_admissorium_support_missing", completionSupport.some(entry => entry?.subsystem === "ADMISSORIUM_V020" && entry?.excluded_from_sovereign_completion_count === true));
  push(failures, "integrity_admissorium_support_missing", integritySupport.some(entry => entry?.subsystem === "ADMISSORIUM_V020" && entry?.excluded_from_sovereign_completion_count === true));

  push(failures, "board_system_complete", board?.system_complete === true);
  push(failures, "board_next_action", board?.next_valid_action === "NO_NEXT_ACTION_VERIFRAX_SYSTEM_COMPLETE");
  push(failures, "board_closed_set", sameSet(board?.closed_subsystems, CANONICAL_SOVEREIGN));
  compareProjectedMap(failures, "board", integrityMap, board?.registered_public_control_closures);

  compareProjectedMap(failures, "registry", integrityMap, registry?.registered_public_control_closures);

  return failures;
}

export function evaluateVerificationContract(input) {
  const replayFailures = validateReplay(input);
  const completionFailures = validateCompletion(input);
  const observedSystemComplete = input?.root?.system_complete ?? null;

  return {
    replayFailures,
    completionFailures,
    failures: [...replayFailures, ...completionFailures],
    observedSystemComplete,
    completionProvenanceValid:
      observedSystemComplete === true ? completionFailures.length === 0 : null,
    provesSystemCompletion: false,
    completionAuthority: false
  };
}
