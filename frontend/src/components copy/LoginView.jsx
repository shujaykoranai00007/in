import { useState } from "react";
import { motion } from "framer-motion";

export default function LoginView({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await onLogin(form.email, form.password);
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-grid px-4 py-12 text-slate-800 md:py-16">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="glass-panel grid items-stretch gap-7 rounded-3xl p-6 md:grid-cols-[1.1fr_0.9fr] md:p-9"
        >
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-6 md:p-7">
            <div className="space-y-5">
              <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Professional Publishing Suite
              </p>
              <h1 className="text-3xl font-bold leading-tight font-display md:text-4xl">
                Plan, queue, and publish Instagram content with confidence
              </h1>
              <p className="text-sm text-muted">
                Automa keeps your release cadence clean with scheduling controls, queue visibility, and resilient posting.
              </p>
            </div>

            <div className="mt-7 grid gap-3 text-xs text-slate-700 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3">
                <p className="muted-text">Publishing Reliability</p>
                <p className="mt-1 text-lg font-bold font-display">99.9%</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3">
                <p className="muted-text">Queue Visibility</p>
                <p className="mt-1 text-lg font-bold font-display">Real-time</p>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.45 }}
              className="mt-6 rounded-xl border border-slate-200 bg-white/85 px-4 py-3 text-xs text-slate-700"
            >
              <span className="text-cyan-700">Developed by</span> Jay Bhimani
            </motion.div>
          </div>

          <form className="space-y-4 rounded-2xl border border-slate-200 bg-white/85 p-5 md:p-6" onSubmit={handleSubmit}>
            <p className="muted-text text-xs uppercase tracking-[0.18em]">Secure Sign In</p>
            <h2 className="text-2xl font-bold font-display">Welcome Back</h2>

            <label className="block text-sm text-muted">
              Admin email
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="field-base mt-2 w-full px-4 py-3 text-sm"
                placeholder="name@company.com"
              />
            </label>

            <label className="block text-sm text-muted">
              Password
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                className="field-base mt-2 w-full px-4 py-3 text-sm"
                placeholder="Enter your password"
              />
            </label>

            {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="pro-btn w-full px-4 py-3 text-sm"
            >
              {loading ? "Signing in..." : "Open Dashboard"}
            </button>

            <p className="muted-text text-center text-xs">Protected access for authorized admin users only.</p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
