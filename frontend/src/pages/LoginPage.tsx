import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { authStatus, signIn, type AuthResult } from '@/lib/api';

type LoginPageProps = { onSignedIn: (auth: AuthResult) => void };

export function LoginPage({ onSignedIn }: LoginPageProps) {
  const [email, setEmail] = useState(localStorage.getItem('servicepro.rememberedEmail') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(Boolean(localStorage.getItem('servicepro.rememberedEmail')));
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    authStatus().then(setConfigured).catch(() => setConfigured(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const auth = await signIn(email.trim(), password);
      if (rememberEmail) localStorage.setItem('servicepro.rememberedEmail', email.trim());
      else localStorage.removeItem('servicepro.rememberedEmail');
      onSignedIn(auth);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-aside">
        <div className="login-brand-panel">
          <img className="login-logo" src="/servicepro-logo.jpeg" alt="ServicePro" />
          <p className="eyebrow">FIELD SERVICE MANAGEMENT</p>
          <h1>Every branch.<br />Every service.<br /><span>In good hands.</span></h1>
          <p className="login-aside-copy">A connected workspace for managing bank branches, service assets and field operations.</p>
          <div className="login-assurance"><ShieldCheck size={18} /><span>Secure access for your service team</span></div>
        </div>
          <div className="login-aside-footer">Plan • Service • Track • Manage • Grow.</div>
      </section>

      <section className="login-main">
        <div className="login-card">
          <div className="login-lock"><LockKeyhole size={21} /></div>
          <p className="eyebrow">SERVICEPRO WORKSPACE</p>
          <h2>Welcome back</h2>
          <p className="login-subtitle">Sign in to continue to your operations dashboard.</p>

          {configured === false && (
            <div className="setup-alert" role="status">
              <strong>Administrator access is not configured.</strong>
              <span>Set APP_AUTH_USERNAME and APP_AUTH_PASSWORD for the backend before signing in.</span>
            </div>
          )}
          {configured === null && <div className="notice-line">Checking sign-in configuration…</div>}
          {error && <div className="form-error" role="alert">{error}</div>}

          <form onSubmit={submit} className="login-form">
            <label htmlFor="login-email">Work email</label>
            <input id="login-email" type="email" autoComplete="username" required value={email}
              onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />

            <div className="password-label-row">
              <label htmlFor="login-password">Password</label>
              <span className="muted-caption">Contact your administrator if you need access help.</span>
            </div>
            <div className="password-input-wrap">
              <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
              <button type="button" className="icon-button password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <label className="remember-row"><input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} /> Remember email on this device</label>
            <button type="submit" className="button button-primary login-submit" disabled={loading || configured === false}>
              {loading ? <span className="spinner" /> : null}{loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="login-legal">Your credentials are checked by the ServicePro backend. This browser session is cleared when you sign out.</p>
        </div>
        <footer className="login-footer">© {new Date().getFullYear()} ServicePro <span>·</span> Smart Service. Reliable Maintenance.</footer>
      </section>
    </main>
  );
}
