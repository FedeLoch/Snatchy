const fs = require('fs');
const p = 'src/ui/lift-analysis.ts';
const s = fs.readFileSync(p, 'utf8');

const tfMarker = s.indexOf('How the score is calculated</summary>');
console.log('tf score-calc idx', tfMarker);
if (tfMarker >= 0) {
  const dOpen = s.lastIndexOf('<details', tfMarker); // <details class="score-calc"> or <details>
  const dClose = s.indexOf('</details>', tfMarker) + '</details>'.length;
  console.log('dOpen', dOpen, 'dClose', dClose);
  console.log('A block head:', JSON.stringify(s.slice(dOpen, dOpen + 90)));
  console.log('A block tail:', JSON.stringify(s.slice(dClose - 60, dClose)));
}

const bOpen = s.indexOf('<details class="bar-notes">');
console.log('bar-notes idx', bOpen);
if (bOpen >= 0) {
  const bClose = s.indexOf('</details>', bOpen) + '</details>'.length;
  console.log('B block head:', JSON.stringify(s.slice(bOpen, bOpen + 90)));
  console.log('B block tail:', JSON.stringify(s.slice(bClose - 60, bClose)));
}
