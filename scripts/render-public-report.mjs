import fs from "node:fs/promises";

const reportPath = "reports/public-control-verify.latest.json";
const publicReportPath = "public/reports/public-control-verify.latest.json";

const report = JSON.parse(await fs.readFile(reportPath, "utf8"));

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

await fs.mkdir("public/reports", { recursive: true });
await fs.copyFile(reportPath, publicReportPath);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VERIFRAX External Control Verify</title>
<style>
body{margin:0;background:#0f1115;color:#f4f5f7;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55}
main{max-width:960px;margin:0 auto;padding:48px 20px 72px}h1{font-size:clamp(38px,7vw,78px);line-height:.92;margin:0;letter-spacing:-.05em}
.panel{border:1px solid #303846;background:#171b22;border-radius:18px;padding:22px;margin-top:22px}a{color:#8ab4ff}code{border:1px solid #303846;border-radius:8px;padding:2px 6px}.muted{color:#a4acb8}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.value{font-weight:700}@media(max-width:650px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body><main>
<div class="muted">VERIFRAX / external-control-verify</div>
<h1>External control verifier.</h1>
<section class="panel">
<h2><code>${esc(report.state)}</code></h2>
<p>This verifier replays public control and, when the root projects completion, verifies the separately authorized completion provenance. It does not create completion authority.</p>
<div class="grid">
<div>Observed system completion<br><span class="value">${esc(report.observed_system_complete)}</span></div>
<div>Completion provenance<br><span class="value">${esc(report.completion_provenance_state)}</span></div>
<div>Verifier proves system completion<br><span class="value">${esc(report.proves_system_completion)}</span></div>
<div>Verifier is completion authority<br><span class="value">${esc(report.completion_authority)}</span></div>
</div>
<p>Machine report: <a href="./reports/public-control-verify.latest.json">reports/public-control-verify.latest.json</a></p>
</section>
<section class="panel"><strong>Boundary</strong><p><code>${esc(report.external_replay_boundary)}</code></p></section>
</main></body></html>\n`;

await fs.writeFile("public/index.html", html);
console.log("VERIFRAX_EXTERNAL_CONTROL_VERIFY_PUBLIC_REPORT_RENDERED=true");
