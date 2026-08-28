# VERIFRAX-CONTROL-VERIFY

External replay and completion-provenance verifier for the VERIFRAX public control fixed point.

This repository does **not** define VERIFRAX state and does **not** issue `VERIFRAX_SYSTEM_COMPLETE`. It verifies the live public control chain from outside the root and status repositories.

The verifier now keeps two propositions separate:

1. **External replay** — whether the declared public fixed point, replay, receipt, perimeter, root, and intake boundaries are externally reproducible.
2. **Completion provenance** — if the current root projects `system_complete: true`, whether that claim is backed by the separately authorized completion closure and the exact nine repository-scoped sovereign closure bindings.

`VERIFRAX_EXTERNAL_CONTROL_VERIFY_GREEN` means those external checks passed. It never means the verifier created, issued, or independently authorized `VERIFRAX_SYSTEM_COMPLETE`.

Current completion authority remains external to this repository. The verifier checks the provenance published by `Verifrax/VERIFRAX-WWW`, including the preserved PR #186 authority and the independently reviewed completion-graph repair merged as PR #187.

## Boundary

- External replay can verify replayability.
- External replay can verify the provenance of an already-authorized completion projection.
- External replay cannot create system completion.
- External replay cannot issue authority.
- External replay cannot verify or recognize terminal truth.
- External replay cannot assign terminal recourse.

The machine report therefore exposes `observed_system_complete`, `completion_provenance_valid`, `proves_system_completion: false`, and `completion_authority: false` rather than treating a verifier-owned `system_complete` field as global system truth.
