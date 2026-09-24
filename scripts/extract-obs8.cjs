const fs = require("fs");
const p = "src/ui/lift-analysis.ts";
let s = fs.readFileSync(p, "utf8");

/* ---- obs 8: extract bar-notes explainer @9978 and remove it from barPanel.
        leaving the dashed-ideal curve + WRIST-LINE ESTIMATE + metrics in place ---- */
const openTag = "<details class=\"bar-notes\">";
const openAt = s.indexOf(openTag);            // expect 9978
const closeAt = s.indexOf("</details>", openAt) + "</details>".length下有;
const barNotes = s.slice(openAt, closeAt);
console.log("barNotes bytes", barNotes.length, "head", JSON.stringify(barNotes.slice(0, 46)), "tail", JSON.stringify(barNotes.slice(-46)));

/* new export inserted right before `export function barPanel` */
const bpAnchor = "export function barPanel";
const bpIdx = s.indexOf(bpAnchor);
const stub =
  "/** How this path is estimated — shown in the About-this-analysis footer. */\n" +
  "export function barEstimation(a: { estimatePhase?: string }): string {\n" +
  "  return `<section class=\"about-block\" aria-label=\"How this path is estimated\">" + barNotes.replace(/`/g, "\\`") + "</section>`;\n" +
  "}\n\n";
s = s.slice(0, bpIdx) + stub + s.slice(bpIdx);

/* remove the details from barPanel's return */
s = s.slice(0, openAt) + s.slice(closeAt);

/* clean up the empty helper I stubbed earlier (it was never written) */
fs.writeFileSync(p, s);
console.log("wrote", p, "len", s.length);
