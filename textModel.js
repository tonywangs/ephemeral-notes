// textModel.js — tokenizing + clause segmentation shared by canvas and archive.
// Exposes: tokenize, segmentText, countWords.
(function () {
  // Split into runs of word | whitespace, each with char offset.
  function tokenize(text) {
    const out = [];
    const re = /\S+|\s+/g;
    let m;
    while ((m = re.exec(text))) {
      out.push({ text: m[0], start: m.index, end: m.index + m[0].length, space: /^\s+$/.test(m[0]) });
    }
    return out;
  }

  function countWords(text) {
    const t = (text || "").trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }

  // Split text into clauses at clause/sentence punctuation. The delimiter stays
  // attached to the clause that precedes it. `terminal` = clause closed by punctuation.
  function segmentText(text) {
    const segs = [];
    const re = /[.,;:!?…—\n]+/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      const end = m.index + m[0].length;
      const s = text.slice(last, end);
      if (s.trim().length || s.length) segs.push({ start: last, end, text: s, terminal: true });
      last = end;
    }
    if (last < text.length) {
      segs.push({ start: last, end: text.length, text: text.slice(last), terminal: false });
    }
    // drop empty leading/trailing pure-whitespace segments
    return segs.filter((s) => s.text.length > 0);
  }

  Object.assign(window, { tokenize, segmentText, countWords });
})();
