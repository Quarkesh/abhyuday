import { useEffect, useState } from "react";

const api = (path, options) =>
  fetch(`/api/${path}`, options).then((res) => res.json());

const pad = (n) => String(n).padStart(2, "0");

const formatTime = (s) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

const rupees = (n) => `₹${n.toFixed(4)}`;

const steps = ["Phone NPU", "Tokens", "Bittensor", "Stablecoin"];

const STORE_KEY = "relay-inr";
const MISSING = "Not exposed by browser";

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
};

const gpuName = () => {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const raw = gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    const inner = raw.match(/^ANGLE \((.*)\)$/);
    const parts = inner ? inner[1].split(", ") : [raw];
    return parts.length > 1 ? parts[1] : parts[0];
  } catch {
    return null;
  }
};

const readSpecs = async () => {
  const ua = navigator.userAgent;
  const uad = navigator.userAgentData;
  let model = null;
  let system = null;

  if (uad && uad.getHighEntropyValues) {
    try {
      const h = await uad.getHighEntropyValues(["model", "platformVersion"]);
      model = h.model || null;
      if (uad.platform === "Android") {
        const v = parseInt(h.platformVersion, 10);
        system = v ? `Android ${v}` : "Android";
      } else {
        system = uad.platform || null;
      }
    } catch {}
  }

  if (!system) {
    system = /iPhone|iPad/.test(ua) ? "iOS" : navigator.platform || MISSING;
  }

  if (!model) {
    if (/iPhone/.test(ua)) model = "iPhone";
    else if (/iPad/.test(ua)) model = "iPad";
  }

  const ratio = Number((window.devicePixelRatio || 1).toFixed(2));
  const cores = navigator.hardwareConcurrency;
  const memory = navigator.deviceMemory;

  return [
    ["Device", model || MISSING],
    ["System", system],
    ["CPU", cores ? `${cores} cores` : MISSING],
    ["Memory", memory ? `~${memory} GB` : MISSING],
    ["GPU", gpuName() || MISSING],
    ["Screen", `${screen.width} × ${screen.height} (${ratio}x)`],
  ];
};

export default function App() {
  const [saved] = useState(load);
  const [rate, setRate] = useState(0.2 / 300);
  const [banked, setBanked] = useState(saved.banked || 0);
  const [startedAt, setStartedAt] = useState(saved.startedAt || null);
  const [now, setNow] = useState(Date.now());
  const [summary, setSummary] = useState(null);
  const [specs, setSpecs] = useState([]);

  const running = startedAt !== null;
  const elapsed = running ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const balance = banked + elapsed * rate;

  useEffect(() => {
    api("rate")
      .then((d) => {
        if (typeof d.rate === "number") setRate(d.rate);
      })
      .catch(() => {});
    readSpecs().then(setSpecs);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ banked, startedAt }));
    } catch {}
  }, [banked, startedAt]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const start = () => {
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
    setSummary(null);
  };

  const stop = async () => {
    const seconds = elapsed;
    let earned = seconds * rate;
    let next = banked + earned;
    try {
      const res = await api("settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds, banked }),
      });
      if (typeof res.balance === "number" && typeof res.earned === "number") {
        earned = res.earned;
        next = res.balance;
      }
    } catch {}
    setBanked(next);
    setStartedAt(null);
    setSummary({ earned, seconds });
  };

  return (
    <div>
      <header className="topbar">
        <div className="logo">Relay</div>
        <div className="wallet">
          <span className="wallet-label">Stablecoin</span>
          <span className="wallet-value">{rupees(balance)}</span>
        </div>
      </header>

      <main>
        <section className="card">
          <div className={`status ${running ? "on" : ""}`}>
            {running ? "Generating" : "Idle"}
          </div>
          <h1 className="headline">Your phone's NPU, paid in stablecoin.</h1>
          <div className="timer">{formatTime(elapsed)}</div>
          {summary && !running && (
            <p className="summary">
              You earned {rupees(summary.earned)} in {formatTime(summary.seconds)}.
            </p>
          )}
          <button
            className={`toggle ${running ? "stop" : "start"}`}
            onClick={running ? stop : start}
          >
            {running ? "Stop generation" : "Start generation"}
          </button>

          {specs.length > 0 && (
            <div className="device">
              <h2 className="device-title">Your device</h2>
              <div className="specs">
                {specs.map(([label, value]) => (
                  <div className="spec" key={label}>
                    <span className="spec-label">{label}</span>
                    <span className="spec-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="pipeline">
          {steps.map((name, i) => (
            <div className="step-wrap" key={name}>
              <div className={`step s${i} ${running ? "active" : ""}`}>{name}</div>
              {i < steps.length - 1 && <span className="arrow">→</span>}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
