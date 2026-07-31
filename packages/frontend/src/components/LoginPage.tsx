import React, { useState, useEffect } from "react";
import { Eye, EyeOff, LogIn, XCircle, Loader2 } from "lucide-react";
import { APP_NAME, APP_VERSION } from "../lib/version";
import { useTranslation } from "react-i18next";

interface LoginPageProps {
  onLogin: (user: { id?: number; email?: string; username?: string; fullName?: string; roles?: string[] }) => void;
  onSwitchToSignup?: () => void;
}

/* ── Inline styles for animations not possible with Tailwind alone ── */
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
@keyframes grid-drift {
  0% { transform: translate(0, 0); }
  100% { transform: translate(40px, 40px); }
}
@keyframes float-up {
  0% { transform: translateY(0) scale(1); opacity: 0.07; }
  50% { opacity: 0.12; }
  100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
}
`;

/* ── Architectural SVG pattern (isometric grid + building silhouettes) ── */
const archPatternSvg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <defs><style>line,rect,polygon{stroke:rgba(255,255,255,0.06);fill:none;stroke-width:0.5;}</style></defs>
  <line x1="0" y1="0" x2="120" y2="120"/>
  <line x1="120" y1="0" x2="0" y2="120"/>
  <line x1="60" y1="0" x2="60" y2="120"/>
  <line x1="0" y1="60" x2="120" y2="60"/>
  <rect x="20" y="20" width="80" height="80" rx="1"/>
  <rect x="40" y="40" width="40" height="40" rx="1"/>
  <polygon points="60,10 110,60 60,110 10,60"/>
</svg>`);

/* ── Shared layout components ── */

const Background = ({ children }: { children: React.ReactNode }) => (
  <div className="fixed inset-0 flex items-center justify-center overflow-hidden"
    style={{
      background: "linear-gradient(160deg, #0a1628 0%, #0f2030 20%, #0d3b3f 45%, #0a2a35 65%, #0f1e2e 85%, #0a1628 100%)",
      backgroundSize: "300% 300%",
      animation: "gradient-shift 20s ease infinite",
    }}
  >
    {/* Architectural grid pattern */}
    <div className="fixed inset-0" style={{
      backgroundImage: `url("data:image/svg+xml,${archPatternSvg}")`,
      backgroundSize: "120px 120px",
      animation: "grid-drift 30s linear infinite",
    }} />
    {/* Subtle radial glow behind the form */}
    <div className="fixed inset-0" style={{
      background: "radial-gradient(ellipse 600px 500px at 50% 45%, rgba(13,148,136,0.12) 0%, transparent 70%)",
    }} />
    {/* Floating architectural particles */}
    <div className="fixed inset-0 pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="absolute" style={{
          left: `${15 + i * 14}%`,
          bottom: "-20px",
          width: `${2 + (i % 3)}px`,
          height: `${30 + i * 15}px`,
          background: `linear-gradient(to top, rgba(20,184,166,${0.08 + (i % 3) * 0.03}), transparent)`,
          animation: `float-up ${12 + i * 4}s linear ${i * 2}s infinite`,
        }} />
      ))}
    </div>
    {/* Noise overlay */}
    <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')" }} />
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
  <div className="text-center mt-8 space-y-2">
    <div className="flex items-center justify-center gap-2 opacity-60">
      <svg viewBox="0 0 140 20" className="h-3.5" fill="none">
        <text x="0" y="15" fontFamily="system-ui, sans-serif" fontWeight="600" fontSize="13" fill="rgba(148,163,184,0.8)" letterSpacing="0.5">OpenAEC Foundation</text>
      </svg>
    </div>
    <p className="text-[10px] text-slate-600 font-mono tracking-wider">v{APP_VERSION}</p>
  </div>
);

export default function LoginPage({ onLogin, onSwitchToSignup }: LoginPageProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  // Is OpenAEC SSO configured on the server? Controls the button's visibility.
  useEffect(() => {
    fetch("/api/auth/openaec/config", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setSsoEnabled(!!d.enabled))
      .catch(() => setSsoEnabled(false));
  }, []);

  // Surface an SSO failure relayed back as ?sso_error=… on the login URL.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("sso_error");
    if (reason) {
      setError(t(`login.sso_error_${reason}`, { defaultValue: t("login.sso_error_generic", { defaultValue: "OpenAEC login mislukt. Probeer opnieuw." }) }));
      // Strip the param so a refresh doesn't re-show the error.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [t]);

  async function handleSubmit() {
    if (!email || !password) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/yapp/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.ok && data.user) {
        onLogin({ id: data.user.id, email: data.user.email });
      } else {
        setError(data.error || t("login.error_failed"));
      }
    } catch (err) {
      setError((err as Error).message || t("login.error_connection"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Background>
      <div className="w-full max-w-md mx-4" style={{ animation: "fade-in-up 0.5s ease-out" }}>
        <div className="text-center mb-8">
          <YLogo />
          <h1 className="text-3xl font-bold text-white mt-5 tracking-tight">{APP_NAME}</h1>
          <p className="text-sm text-teal-300/70 mt-2 font-medium">{t("login.title")}</p>
        </div>

        <div className="bg-white/[0.08] backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/30 border border-white/[0.12] p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t("login.email_label")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.email_placeholder")}
              className="w-full px-4 py-2.5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-transparent transition-shadow duration-200 bg-white/[0.06] hover:bg-white/[0.1]"
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t("login.password_label")}</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("login.password_placeholder")}
                className="w-full px-4 py-2.5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-transparent pr-10 transition-shadow duration-200 bg-white/[0.06] hover:bg-white/[0.1]"
                onKeyDown={(e) => { if (e.key === "Enter" && email && password && !loading) handleSubmit(); }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors duration-150"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-2" style={{ animation: "fade-in-up 0.2s ease-out" }}>
              <XCircle size={16} className="flex-shrink-0" /> {error}
            </div>
          )}

          <button
            disabled={!email || !password || loading}
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-xl disabled:opacity-50 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/25 hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: "linear-gradient(135deg, #0d9488, #14b8a6)" }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {loading ? t("login.logging_in") : t("login.submit")}
          </button>

          {ssoEnabled && (
            <>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[11px] uppercase tracking-wider text-slate-500">{t("login.or", { defaultValue: "of" })}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <button
                type="button"
                onClick={() => { window.location.href = "/api/auth/openaec/login"; }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 bg-white/[0.08] border border-white/15 text-white hover:bg-white/[0.14]"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gradient-to-br from-amber-400 to-orange-500 text-[11px] font-bold text-white">A</span>
                {t("login.sso_openaec", { defaultValue: "Inloggen met OpenAEC" })}
              </button>
            </>
          )}

          {onSwitchToSignup && (
            <div className="text-center text-xs text-slate-400 pt-2">
              {t("login.no_account", { defaultValue: "Don't have an account?" })}{" "}
              <button
                type="button"
                onClick={onSwitchToSignup}
                className="text-y-teal hover:text-y-teal-dark font-medium cursor-pointer"
              >
                {t("login.sign_up", { defaultValue: "Sign up" })}
              </button>
            </div>
          )}
        </div>

        <Footer />
      </div>
    </Background>
  );
}
