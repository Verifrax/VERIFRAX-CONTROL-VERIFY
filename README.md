# VERIFRAX-CONTROL-VERIFY

External replay verifier for the VERIFRAX public control fixed point.

This repository does not define VERIFRAX state. It verifies the live public control chain from outside the root and status surface repositories.

Verified chain:

1. `https://status.verifrax.net/control-receipt/finality.json`
2. `https://status.verifrax.net/control-receipt/replay.json`
3. `https://status.verifrax.net/control-receipt/receipt.json`
4. `https://status.verifrax.net/perimeter/status.json`
5. `https://www.verifrax.net/system-control.json`
6. `https://www.verifrax.net/data/verifrax-system-control.json`
7. `https://apply.verifrax.net/`

Boundary:

- `VERIFRAX_EXTERNAL_CONTROL_VERIFY_GREEN` means the public control fixed point is externally replayable.
- It does not mean `VERIFRAX_SYSTEM_COMPLETE`.
- It does not issue authority.
- It does not verify terminal truth.
- It does not recognize terminal truth.
- It does not assign terminal recourse.
