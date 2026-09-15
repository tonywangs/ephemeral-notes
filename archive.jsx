// archive.jsx — looking back. Past entries become fully visible again,
// recolored by the moods detected while writing them.
const { useState: useArchState } = React;

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function fmtDur(ms) {
  const m = Math.round((ms || 0) / 60000);
  if (m < 1) return "under a minute";
  if (m === 1) return "1 minute";
  if (m < 60) return m + " minutes";
  const h = Math.floor(m / 60), r = m % 60;
  return h + "h " + (r ? r + "m" : "");
}

// Recolor a saved entry: segment its text, color each clause by saved moodList.
function ColoredEntry({ entry, dark, intensity, fontFamily }) {
  const segs = window.segmentText(entry.text);
  const moodList = entry.moodList || [];
  return (
    <div className="reader-text" style={{ fontFamily }}>
      {segs.map((s, i) => {
        const mood = moodList[i];
        const color = mood ? window.moodColor(mood, intensity, dark) : (dark ? "#cfcabf" : "#3a382f");
        return <span key={i} style={{ color }}>{s.text}</span>;
      })}
    </div>
  );
}

function Archive({ entries, onBack, onDelete, dark, tweaks, inkColor }) {
  const sorted = [...entries].sort((a, b) => b.startedAt - a.startedAt);
  const [selId, setSel] = useArchState(sorted.length ? sorted[0].id : null);
  const sel = sorted.find((e) => e.id === selId) || sorted[0];

  return (
    <div className="archive">
      <div className="archive-head">
        <button className="ghost-btn" onClick={onBack}>← Back to writing</button>
        <div className="archive-title">The Archive</div>
        <div className="archive-count">{sorted.length} {sorted.length === 1 ? "entry" : "entries"}</div>
      </div>

      {sorted.length === 0 ? (
        <div className="archive-empty">
          <div className="archive-empty-lead">Nothing here yet.</div>
          <div className="archive-empty-sub">Whatever you write — even what fades while you write it — is kept here for you to return to.</div>
          <button className="ghost-btn" onClick={onBack}>Start writing</button>
        </div>
      ) : (
        <div className="archive-body">
          <div className="entry-list">
            {sorted.map((e) => {
              const headline = window.weatherHeadline(e.counts || {});
              const snippet = (e.text || "").trim().slice(0, 90);
              return (
                <button
                  key={e.id}
                  className={"entry-card" + (e.id === sel.id ? " active" : "")}
                  onClick={() => setSel(e.id)}
                >
                  <div className="entry-card-top">
                    <span className="entry-date">{fmtDate(e.startedAt)}</span>
                    <span className="entry-time">{fmtTime(e.startedAt)}</span>
                  </div>
                  <div className="entry-snippet">{snippet || "…"}</div>
                  <window.MoodWeather counts={e.counts || {}} dark={dark} height={6} />
                  <div className="entry-meta">{e.wordCount} words · {headline}</div>
                </button>
              );
            })}
          </div>

          <div className="reader">
            {sel && (
              <div className="reader-inner">
                <div className="reader-head">
                  <div>
                    <div className="reader-date">{fmtDate(sel.startedAt)}</div>
                    <div className="reader-sub">
                      {fmtTime(sel.startedAt)} · {sel.wordCount} words · {fmtDur((sel.endedAt || sel.startedAt) - sel.startedAt)}
                    </div>
                  </div>
                  <button className="del-btn" onClick={() => onDelete(sel.id)} title="Delete entry">Delete</button>
                </div>

                <div className="reader-weather">
                  <window.MoodWeather counts={sel.counts || {}} dark={dark} height={12} showLegend />
                  <div className="reader-headline">{window.weatherHeadline(sel.counts || {})}</div>
                </div>

                <ColoredEntry
                  entry={sel}
                  dark={dark}
                  intensity={tweaks.colorIntensity}
                  fontFamily={tweaks.fontFamily}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

window.Archive = Archive;
