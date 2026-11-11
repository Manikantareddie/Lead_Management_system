import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api";
import { RefreshCw, LogIn, AlertCircle, Info } from "lucide-react";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "38px",
  padding: "0 12px",
  borderRadius: "6px",
  border: "1px solid var(--border-subtle)",
  backgroundColor: "#ffffff",
  color: "var(--text-main)",
  fontSize: "13px",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-main)",
  marginBottom: "6px",
};

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!username.trim() || !password.trim()) {
      setValidationError("Please enter both your username and password.");
      return;
    }
    setValidationError(null);
    setSubmitting(true);

    try {
      await login(username.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Unable to sign in right now. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const errorMessage = validationError || submitError;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-primary)",
        padding: "24px",
      }}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: "400px", padding: "32px 28px", margin: 0 }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--text-main)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            YottaFlex
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "6px 0 0 0" }}>
            Lead Intelligence &amp; Operations Console
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              padding: "10px 12px",
              marginBottom: "16px",
              backgroundColor: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
              borderRadius: "6px",
              fontSize: "13px",
              color: "var(--danger-text)",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="login-username" style={labelStyle}>
              Username <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={Boolean(validationError)}
              style={inputStyle}
              placeholder="Enter your username"
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="login-password" style={labelStyle}>
              Password <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(validationError)}
              style={inputStyle}
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {submitting ? <RefreshCw size={14} className="spin" /> : <LogIn size={14} />}
            <span>{submitting ? "Signing in..." : "Sign in"}</span>
          </button>
        </form>

        <div
          style={{
            marginTop: "22px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <Info size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: "1px" }} />
          <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: "2px" }}>
              Demo accounts
            </div>
            <div>
              <strong style={{ color: "var(--text-secondary)" }}>admin</strong> / admin123
            </div>
            <div>
              <strong style={{ color: "var(--text-secondary)" }}>manager</strong> / manager123
            </div>
            <div>
              <strong style={{ color: "var(--text-secondary)" }}>rep</strong> / rep123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
