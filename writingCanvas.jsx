// writingCanvas.jsx — the ephemeral writing surface.
// Forward-only typing; words rise, blur, and fade by word-distance; clauses
// bloom into their detected mood color. Emits live state to the parent.
const { useRef, useState, useEffect, useMemo, useCallback } = React;

const PROMPTS = [
  "What's sitting with you right now?",
  "Say the thing you haven't said yet.",
  "Where did your mind keep drifting today?",
  "What do you want to let go of?",
  "Describe this moment, exactly as it feels.",
  "What's underneath the busy?",
  "Finish: lately I keep noticing\u2026",
  "What are you grateful for, and what's hard?",
];

function WritingCanvas({ text, setText, tweaks, dark, inkColor, onState, sessionKey }) {
  const taRef = useRef(null);
  const wrapRef = useRef(null);
  const [segMoods, setSegMoods] = useState({});
  const moodTextRef = useRef({});
  const debounceRef = useRef(null);
  const [promptIdx] = useState(() => Math.floor(Math.random() * PROMPTS.length));

  // Reset mood memory when a new session starts.
  useEffect(() => {
    setSegMoods({});
    moodTextRef.current = {};
  }, [sessionKey]);

  const segments = useMemo(() => window.segmentText(text), [text]);
  const tokens = useMemo(() => window.tokenize(text), [text]);

  // Keep focus on the hidden input.
  const focus = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    const n = ta.value.length;
    try { ta.setSelectionRange(n, n); } catch (e) {}
  }, []);
  useEffect(() => { focus(); }, [focus, sessionKey]);

  // Debounced AI classification of clauses.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runClassify, 650);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line
  }, [text]);

  async function runClassify() {
    const segs = window.segmentText(text);
    const todo = [];
    const idxs = [];
    segs.forEach((s, i) => {
      const words = window.countWords(s.text);
      const enough = s.terminal || (i === segs.length - 1 && words >= 4) || words >= 6;
      if (enough && moodTextRef.current[i] !== s.text.trim()) {
        todo.push(s.text.trim());
        idxs.push(i);
      }
    });
    if (!todo.length) return;
    let res;
    try { res = await window.classifyClauses(todo); }
    catch (e) { return; }
    setSegMoods((prev) => {
      const next = { ...prev };
      idxs.forEach((segIdx, k) => {
        const firstTime = moodTextRef.current[segIdx] === undefined;
        next[segIdx] = res[k];
        moodTextRef.current[segIdx] = todo[k];
        if (firstTime && segs[segIdx] && segs[segIdx].terminal && window.WispSound) {
          window.WispSound.chime(window.MOOD_MAP[res[k]].hue);
        }
      });
      return next;
    });
  }

  // Emit live state upward (word count, dominant mood, per-clause moods).
  const moodList = useMemo(
    () => segments.map((s, i) => segMoods[i] || null),
    [segments, segMoods]
  );
  useEffect(() => {
    if (!onState) return;
    const counts = {};
    segments.forEach((s, i) => {
      const m = segMoods[i];
      if (!m) return;
      counts[m] = (counts[m] || 0) + window.countWords(s.text);
    });
    let dominant = null, best = 0;
    Object.keys(counts).forEach((k) => { if (counts[k] > best) { best = counts[k]; dominant = k; } });
    // recent mood = mood of the last classified clause
    let recent = null;
    for (let i = segments.length - 1; i >= 0; i--) { if (segMoods[i]) { recent = segMoods[i]; break; } }
    onState({
      wordCount: window.countWords(text),
      counts,
      dominant,
      recent,
      text,
      moodList,
    });
    // eslint-disable-next-line
  }, [text, segMoods]);

  // Input handling — forward-only.
  function onInput(e) {
    const v = e.target.value;
    if (v.length > text.length && window.WispSound) window.WispSound.tick();
    setText(v);
  }
  function onKeyDown(e) {
    if (window.WispSound) window.WispSound.resume();
    const block = ["ArrowUp", "ArrowDown", "PageUp", "PageDown"];
    if (block.includes(e.key)) { e.preventDefault(); focus(); }
  }

  // ----- Render the drifting word field -----
  const totalWords = useMemo(() => window.countWords(text), [text]);
  const visible = tweaks.visibleWords;
  const fadeSpan = Math.max(2, tweaks.fadeSpeed);
  const intensity = tweaks.colorIntensity;

  // map each token to its clause mood via char offset
  const segForOffset = useCallback((off) => {
    for (let i = 0; i < segments.length; i++) {
      if (off >= segments[i].start && off < segments[i].end) return i;
    }
    return segments.length - 1;
  }, [segments]);

  const rendered = useMemo(() => {
    let wordsSoFar = 0;
    const items = [];
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      const isWord = !tk.space;
      const ageBefore = totalWords - 1 - wordsSoFar; // age of this word
      if (isWord) wordsSoFar++;
      const age = isWord ? ageBefore : totalWords - 1 - wordsSoFar; // spaces take next word's age
      let t = 0;
      if (age > visible) t = Math.min(1, (age - visible) / fadeSpan);
      if (t >= 1) continue; // fully faded — gone from view
      const segIdx = segForOffset(tk.start);
      const moodId = segMoods[segIdx];
      const color = moodId ? window.moodColor(moodId, intensity, dark) : inkColor;
      const style = {
        color,
        opacity: 1 - t * 0.96,
        filter: t > 0 ? `blur(${(t * 4.5).toFixed(2)}px)` : "none",
        transform: t > 0 ? `translateY(${(-t * 26).toFixed(1)}px)` : "none",
        transition: "opacity .7s ease, filter .7s ease, transform .7s ease, color .9s ease",
        whiteSpace: "pre-wrap",
      };
      items.push(
        <span key={i} style={style}>{tk.text}</span>
      );
    }
    return items;
    // eslint-disable-next-line
  }, [tokens, segMoods, totalWords, visible, fadeSpan, intensity, dark, inkColor]);

  const recentMood = useMemo(() => {
    for (let i = segments.length - 1; i >= 0; i--) if (segMoods[i]) return segMoods[i];
    return null;
  }, [segments, segMoods]);
  const caretColor = recentMood ? window.moodColor(recentMood, intensity, dark) : inkColor;

  const empty = text.trim().length === 0;

  return (
    <div ref={wrapRef} className="canvas-wrap" onMouseDown={(e) => { focus(); }}>
      <textarea
        ref={taRef}
        className="hidden-input"
        value={text}
        onInput={onInput}
        onChange={() => {}}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(focus, 0)}
        spellCheck={false}
        autoFocus
      />
      {empty ? (
        <div className="prompts" style={{ color: inkColor }}>
          <div className="prompt-lead">{PROMPTS[promptIdx]}</div>
          <div className="prompt-hint">just start typing… your words will rise and fade</div>
        </div>
      ) : (
        <div
          className="word-field"
          style={{ fontFamily: tweaks.fontFamily, fontSize: tweaks.fontSize + "px", color: inkColor }}
        >
          {rendered}
          <span className="caret" style={{ background: caretColor, height: tweaks.fontSize * 1.05 + "px" }} />
        </div>
      )}
    </div>
  );
}

window.WritingCanvas = WritingCanvas;
window.WISP_PROMPTS = PROMPTS;
