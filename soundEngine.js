// soundEngine.js — gentle, optional audio + haptic feedback.
// Exposes window.WispSound with: enabled flag, tick(), chime(hue), resume().
(function () {
  let ctx = null;
  let master = null;
  const api = {
    enabled: true,
    _ensure() {
      if (ctx) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
    },
    resume() {
      this._ensure();
      if (ctx && ctx.state === "suspended") ctx.resume();
    },
    // Soft wooden tick on keypress — randomized so it never feels mechanical.
    tick() {
      if (!this.enabled) return;
      this._ensure();
      if (!ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 220 + Math.random() * 90;
      const vol = 0.018 + Math.random() * 0.012;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.08);
    },
    // Airy chime when a clause's mood resolves; pitch tracks the hue (color->tone).
    chime(hue) {
      if (!this.enabled) return;
      this._ensure();
      if (!ctx) return;
      const t = ctx.currentTime;
      // Map hue (0..360) onto a pentatonic-ish set of frequencies.
      const scale = [392, 440, 523.25, 587.33, 659.25, 784];
      const f = scale[Math.floor((hue / 360) * scale.length) % scale.length];
      [0, 1].forEach((i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f * (i ? 2 : 1);
        const vol = i ? 0.012 : 0.03;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 1.0);
      });
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
    },
  };
  window.WispSound = api;
})();
