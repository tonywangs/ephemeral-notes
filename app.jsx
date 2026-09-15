// app.jsx — Wisp. Ephemeral, mood-colored journaling.
const { useState: useS, useEffect: useE, useRef: useR, useCallback: useCb } = React;

const TONES = {
  Paper: { bg: "oklch(0.972 0.009 78)",  panel: "oklch(0.95 0.012 78)",  ink: "oklch(0.34 0.014 70)",  faint: "oklch(0.62 0.02 75)",  dark: false },
  Cool:  { bg: "oklch(0.974 0.006 240)", panel: "oklch(0.95 0.008 240)", ink: "oklch(0.35 0.012 250)", faint: "oklch(0.62 0.02 245)", dark: false },
  Bone:  { bg: "oklch(0.971 0.002 100)", panel: "oklch(0.948 0.003 100)",ink: "oklch(0.32 0.004 90)",  faint: "oklch(0.60 0.008 95)", dark: false },
  Night: { bg: "oklch(0.205 0.012 262)", panel: "oklch(0.255 0.014 262)",ink: "oklch(0.84 0.012 250)", faint: "oklch(0.62 0.02 250)", dark: true },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "visibleWords": 7,
  "fadeSpeed": 7,
  "colorIntensity": 1,
  "fontFamily": "'Newsreader', Georgia, serif",
  "fontSize": 34,
  "bgTone": "Paper",
  "sound": true
}/*EDITMODE-END*/;

function fmtClock(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m + ":" + String(s % 60).padStart(2, "0");
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const tone = TONES[t.bgTone] || TONES.Paper;

  const [view, setView] = useS("write");
  const [text, setText] = useS(() => localStorage.getItem("wisp_draft_v1") || "");
  const [startedAt, setStartedAt] = useS(() => {
    const v = localStorage.getItem("wisp_started_v1");
    return v ? +v : null;
  });
  const [sessionKey, setSessionKey] = useS(0);
  const [archiveEntries, setArchive] = useS(() => {
    try { return JSON.parse(localStorage.getItem("wisp_archive_v1") || "[]"); }
    catch (e) { return []; }
  });
  const [now, setNow] = useS(Date.now());
  const stateRef = useR({ wordCount: 0, counts: {}, recent: null, moodList: [], text: "" });
  const [live, setLive] = useS({ wordCount: 0, counts: {}, recent: null });

  // sync sound enable
  useE(() => { if (window.WispSound) window.WispSound.enabled = !!t.sound; }, [t.sound]);

  // persist draft
  useE(() => { localStorage.setItem("wisp_draft_v1", text); }, [text]);
  useE(() => {
    if (startedAt) localStorage.setItem("wisp_started_v1", String(startedAt));
    else localStorage.removeItem("wisp_started_v1");
  }, [startedAt]);
  useE(() => { localStorage.setItem("wisp_archive_v1", JSON.stringify(archiveEntries)); }, [archiveEntries]);

  // session clock
  useE(() => {
    if (view !== "write" || !startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [view, startedAt]);

  const handleText = useCb((v) => {
    setText(v);
    setStartedAt((prev) => (prev == null && v.trim().length ? Date.now() : prev));
  }, []);

  const handleState = useCb((st) => {
    stateRef.current = st;
    setLive({ wordCount: st.wordCount, counts: st.counts, recent: st.recent });
  }, []);

  function finishEntry() {
    const st = stateRef.current;
    if (!st.text.trim()) { setView("archive"); return; }
    const entry = {
      id: "e" + Date.now(),
      startedAt: startedAt || Date.now(),
      endedAt: Date.now(),
      text: st.text,
      wordCount: st.wordCount,
      counts: st.counts,
      moodList: st.moodList,
    };
    setArchive((prev) => [entry, ...prev]);
    setText("");
    setStartedAt(null);
    stateRef.current = { wordCount: 0, counts: {}, recent: null, moodList: [], text: "" };
    setLive({ wordCount: 0, counts: {}, recent: null });
    setSessionKey((k) => k + 1);
    setView("archive");
  }

  function deleteEntry(id) {
    setArchive((prev) => prev.filter((e) => e.id !== id));
  }

  // ambient wash from most recent mood
  const ambient = live.recent
    ? `radial-gradient(125% 85% at 50% 8%, ${window.moodAmbient(live.recent, tone.dark)}, transparent 68%)`
    : "transparent";

  const elapsed = startedAt ? now - startedAt : 0;

  return (
    <div className="app" style={{ background: tone.bg, color: tone.ink }} data-dark={tone.dark}>
      <div className="ambient" style={{ background: ambient }} />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">Wisp</span>
        </div>

        {view === "write" && (
          <div className="hud" style={{ color: tone.faint }}>
            <span className="hud-stat">{live.wordCount} {live.wordCount === 1 ? "word" : "words"}</span>
            <span className="hud-sep">·</span>
            <span className="hud-stat">{fmtClock(elapsed)}</span>
            <div className="hud-weather">
              <window.MoodWeather counts={live.counts} dark={tone.dark} height={6} />
            </div>
          </div>
        )}

        <div className="actions">
          {view === "write" ? (
            <React.Fragment>
              <button className="ghost-btn" onClick={finishEntry} disabled={!live.wordCount}>
                Finish & keep
              </button>
              <button className="ghost-btn" onClick={() => setView("archive")}>Archive</button>
            </React.Fragment>
          ) : (
            <button className="ghost-btn" onClick={() => setView("write")}>Write</button>
          )}
        </div>
      </header>

      <main className="stage">
        {view === "write" ? (
          <window.WritingCanvas
            text={text}
            setText={handleText}
            tweaks={t}
            dark={tone.dark}
            inkColor={tone.ink}
            onState={handleState}
            sessionKey={sessionKey}
          />
        ) : (
          <window.Archive
            entries={archiveEntries}
            onBack={() => setView("write")}
            onDelete={deleteEntry}
            dark={tone.dark}
            tweaks={t}
            inkColor={tone.ink}
          />
        )}
      </main>

      {view === "write" && live.wordCount > 0 && (
        <div className="reassure" style={{ color: tone.faint }}>
          your words fade here, but they're all kept in the archive
        </div>
      )}

      <TweaksPanel>
        <TweakSection label="The fade" />
        <TweakSlider label="Words held in view" value={t.visibleWords} min={2} max={25} step={1}
          onChange={(v) => setTweak("visibleWords", v)} />
        <TweakSlider label="Fade trail (words)" value={t.fadeSpeed} min={2} max={20} step={1}
          onChange={(v) => setTweak("fadeSpeed", v)} />

        <TweakSection label="Mood color" />
        <TweakSlider label="Color intensity" value={t.colorIntensity} min={0.4} max={1.6} step={0.05}
          onChange={(v) => setTweak("colorIntensity", v)} />

        <TweakSection label="Type" />
        <TweakSelect label="Typeface" value={t.fontFamily}
          options={[
            { value: "'Newsreader', Georgia, serif", label: "Newsreader" },
            { value: "'Spectral', Georgia, serif", label: "Spectral" },
            { value: "'Lora', Georgia, serif", label: "Lora" },
            { value: "'Work Sans', system-ui, sans-serif", label: "Work Sans" },
          ]}
          onChange={(v) => setTweak("fontFamily", v)} />
        <TweakSlider label="Text size" value={t.fontSize} min={22} max={56} step={1} unit="px"
          onChange={(v) => setTweak("fontSize", v)} />

        <TweakSection label="Room" />
        <TweakSelect label="Background tone" value={t.bgTone}
          options={["Paper", "Cool", "Bone", "Night"]}
          onChange={(v) => setTweak("bgTone", v)} />
        <TweakToggle label="Sound & haptics" value={t.sound}
          onChange={(v) => setTweak("sound", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
