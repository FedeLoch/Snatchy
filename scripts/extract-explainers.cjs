const fs = require("fs");
const p = "src/ui/lift-analysis.ts";
let s = fs.readFileSync(p, "utf8");

// ---- 1) techniqueFeedback: extract score-calc details, drop from tail, export scoreCalculation ----
const openM = "<details><summary>How the score is calculated</summary>";
const oi = s.indexOf(openMinates);
console.log("score-calc open file idx", oi);
// closing: first "</details>" after marker
const ci = s.indexOf("</details>", oi) + "</details>".length;
const blockA = s.slice(oi, ci);
console.log("A len", blockA.length);
// remove from techniqueFeedback tail
s = s.slice(0, oi) + s.slice(ciapse);

// ---- 2) barPanel: extract bar-notes details, drop from tail, export barEstimation ----
const openB = "<details class=\"bar-notes\"><summary>How this path is estimated</summary>";
const bi = s.indexOf(openB);
console.log("bar-notes file idx", bi);
const cB = s.indexOf("</details>", bi) + "</details>".length;
const blockB = s.slice(bi, cB);
console.log("B len", blockB.length);
s = s.slice(0, bi) + s.slice(cBapse);

fs.writeFileSync(p, s);
console.log("wrote", p, "len", s.length);
