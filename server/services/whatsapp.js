'use strict';
// "2348164212898" -> "+234 816 421 2898" (display only; links use the raw digits)
function formatDisplay(n) {
  const m = /^234(\d{3})(\d{3})(\d{4})$/.exec(n);
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : `+${n}`;
}
module.exports = { formatDisplay };
