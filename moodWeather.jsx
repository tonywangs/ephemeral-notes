// moodWeather.jsx — emotional "weather" bar + headline for a session.
// Exposes window.MoodWeather and window.weatherHeadline.

function MoodWeather({ counts, dark, height, showLegend }) {
  const entries = Object.keys(counts || {})
    .map((id) => ({ id, w: counts[id], mood: window.MOOD_MAP[id] }))
    .filter((e) => e.mood && e.w > 0)
    .sort((a, b) => b.w - a.w);
  const total = entries.reduce((s, e) => s + e.w, 0) || 1;
  const h = height || 10;

  if (!entries.length) {
    return (
      <div className="weather-empty" style={{ height: h }} />
    );
  }
  return (
    <div className="weather">
      <div className="weather-bar" style={{ height: h }}>
        {entries.map((e) => (
          <div
            key={e.id}
            title={e.mood.label}
            style={{
              flex: e.w,
              background: window.moodColor(e.id, 1.05, dark),
            }}
          />
        ))}
      </div>
      {showLegend && (
        <div className="weather-legend">
          {entries.slice(0, 5).map((e) => (
            <div className="legend-item" key={e.id}>
              <span className="legend-dot" style={{ background: window.moodColor(e.id, 1.1, dark) }} />
              <span className="legend-label">{e.mood.label}</span>
              <span className="legend-pct">{Math.round((e.w / total) * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function weatherHeadline(counts) {
  const entries = Object.keys(counts || {})
    .map((id) => ({ id, w: counts[id], mood: window.MOOD_MAP[id] }))
    .filter((e) => e.mood && e.w > 0)
    .sort((a, b) => b.w - a.w);
  if (!entries.length) return "Too few words to read the weather yet.";
  const lc = (s) => s.toLowerCase();
  const dom = lc(entries[0].mood.label);
  if (entries.length === 1) return `All ${dom}.`;
  const sec = lc(entries[1].mood.label);
  if (entries.length === 2) return `Mostly ${dom}, with ${sec} underneath.`;
  const ter = lc(entries[2].mood.label);
  return `Mostly ${dom}, threaded with ${sec} and flashes of ${ter}.`;
}

window.MoodWeather = MoodWeather;
window.weatherHeadline = weatherHeadline;
