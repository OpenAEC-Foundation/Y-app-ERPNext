import React, { useState } from "react";
import { Eye, EyeOff, UserPlus, XCircle, Loader2 } from "lucide-react";
import { APP_NAME, APP_VERSION } from "../lib/version";
import { useTranslation } from "react-i18next";

interface SignupPageProps {
  onSignup: (user: { id: number; email: string }) => void;
  onSwitchToLogin: () => void;
}

/* ── Inline keyframes (kept consistent with LoginPage) ── */
const glowKeyframes = `
@keyframes logo-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(20, 184, 166, 0.3), 0 0 40px rgba(20, 184, 166, 0.1); }
  50% { box-shadow: 0 0 30px rgba(20, 184, 166, 0.5), 0 0 60px rgba(20, 184, 166, 0.2); }
}
@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

const Background = ({ children }: { children: React.ReactNode }) => (
  <div
    className="fixed inset-0 flex items-center justify-center"
    style={{
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 25%, #0f4c5c 50%, #1e293b 75%, #0f172a 100%)",
      backgroundSize: "400% 400%",
      animation: "gradient-shift 15s ease infinite",
    }}
  >
    <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')" }} />
    <style>{glowKeyframes}</style>
    {children}
  </div>
);

const YLogo = () => (
  <div
    className="inline-flex items-center justify-center w-20 h-20 rounded-2xl"
    style={{
      background: "linear-gradient(135deg, #0d9488, #14b8a6, #2dd4bf)",
      animation: "logo-pulse 3s ease-in-out infinite",
    }}
  >
    <svg viewBox="0 0 32 32" className="w-11 h-11">
      <text x="16" y="23" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="20" fill="white" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}>Y</text>
    </svg>
  </div>
);

const Footer = () => (
  <div className="text-center mt-8 space-y-1">
    <p className="text-xs text-slate-500">OpenAEC Foundation</p>
    <p className="text-[10px] text-slate-600">{APP_NAME} v{APP_VERSION}</p>
  </div>
);

export default function SignupPage({ onSignup, onSwitchToLogin }: SignupPageProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError(t("signup.error_required", { defaultValue: "Email and password are required" }));
      return;
    }
    if (password.length < 8) {
      setError(t("signup.error_short_password", { defaultValue: "Password must be at least 8 characters" }));
      return;
    }
    if (password !== confirm) {
      setError(t("signup.error_mismatch", { defaultValue: "Passwords do not match" }));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/yapp/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.ok && data.user) {
        onSignup(data.user);
      } else {
        setError(data.error || t("signup.error_failed", { defaultValue: "Signup failed" }));
      }
    } catch (err) {
      setError((err as Error).message || t("signup.error_connection", { defaultValue: "Connection error" }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Background>
      <div className="relative w-full max-w-md mx-4" style={{ animation: "fade-in-up 0.6s ease-out" }}>
        <div className="text-center mb-8">
          <YLogo />
          <h1 className="text-3xl font-bold text-white mt-4">{t("signup.title", { defaultValue: "Create your Y-app account" })}</h1>
          <p className="text-sm text-slate-400 mt-1">{t("signup.subtitle", { defaultValue: "One account, many ERPNext instances" })}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-7 shadow-2xl space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">{t("signup.email_label", { defaultValue: "Email" })}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-y-teal/50 focus:border-y-teal"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">{t("signup.password_label", { defaultValue: "Password" })}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full px-3 py-2.5 pr-10 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-y-teal/50 focus:border-y-teal"
                placeholder={t("signup.password_placeholder", { defaultValue: "At least 8 characters" })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">{t("signup.confirm_label", { defaultValue: "Confirm password" })}</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-y-teal/50 focus:border-y-teal"
              placeholder={t("signup.confirm_placeholder", { defaultValue: "Repeat your password" })}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg p-2.5">
              <XCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-y-teal hover:bg-y-teal-dark text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {t("signup.submit", { defaultValue: "Create account" })}
          </button>

          <div className="pt-2 text-center text-xs text-slate-400">
            {t("signup.have_account", { defaultValue: "Already have an account?" })}{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-y-teal hover:text-y-teal-light font-medium"
            >
              {t("signup.sign_in", { defaultValue: "Sign in" })}
            </button>
          </div>
        </form>

        <Footer />
      </div>
    </Background>
  );
}
