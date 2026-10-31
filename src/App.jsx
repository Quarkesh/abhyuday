import { useEffect, useState } from "react";

const api = (path, options) =>
  fetch(`/api/${path}`, options).then((res) => res.json());

const pad = (n) => String(n).padStart(2, "0");

const formatTime = (s) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

const steps = ["Phone NPU", "Tokens", "Bittensor", "Stablecoin"];

const load = () => {
  try {
    return JSON.parse(localStorage.getItem("relay")) || {};
  } catch {
    return {};
  }
};

export default function App() {
  const [saved] = useState(load);
  const [rate, setRate] = useState(0.01);
  const [banked, setBanked] = useState(saved.banked || 0);
  const [startedAt, setStartedAt] = useState(saved.startedAt || null);
  const [now, setNow] = useState(Date.now());

  const running = startedAt !== null;
  const elapsed = running ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const balance = banked + elapsed * rate;

  useEffect(() => {
    api("rate")
      .then((d) => setRate(d.rate))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("relay", JSON.stringify({ banked, startedAt }));
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
  };

  const stop = async () => {
    let next = Math.round((banked + elapsed * rate) * 100) / 100;
    try {
      const res = await api("settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds: elapsed, banked }),
      });
      next = res.balance;
    } catch {}
    setBanked(next);
    setStartedAt(null);
  };

  return (
    <div>
      <header className="topbar">
        <div className="logo">Relay</div>
        <div className="wallet">
          <span className="wallet-label">Stablecoin</span>
          <span className="wallet-value">${balance.toFixed(2)}</span>
        </div>
      </header>

      <main>
        <section className="card">
          <div className={`status ${running ? "on" : ""}`}>
            {running ? "Generating" : "Idle"}
          </div>
          <div className="rate">+{rate.toFixed(2)} per second</div>
          <h1 className="headline">Your phone's NPU, paid in stablecoin.</h1>
          <div className="timer">{formatTime(elapsed)}</div>
          <button
            className={`toggle ${running ? "stop" : "start"}`}
            onClick={running ? stop : start}
          >
            {running ? "Stop generation" : "Start generation"}
          </button>
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
