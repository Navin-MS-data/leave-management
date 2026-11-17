import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { homePath, useAuth } from '../auth/AuthContext';
import { Note } from '../components/ui';

const DEMO = [
  { label: 'Employee', email: 'employee1@example.com', hint: 'Emma Stone, team A' },
  { label: 'Manager', email: 'manager1@example.com', hint: 'Maria Manager, team A' },
  { label: 'Admin', email: 'admin@example.com', hint: 'Alex Admin' },
];

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homePath(user.role)} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your work email and password, or pick a demo account below.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const signedIn = await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : homePath(signedIn.role), { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login" id="main">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <svg width="30" height="30" viewBox="0 0 26 26" aria-hidden="true">
            <rect x="3" y="2" width="20" height="22" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 2v22" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 9h7M12 13h7M12 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>Passbook</span>
        </div>

        <div className="login-body">
          <h1 id="login-title">Sign in</h1>
          <p className="muted">Your leave balance, requests and team calendar.</p>

          <form onSubmit={submit} className="stack" noValidate>
            {error ? <Note tone="error">{error}</Note> : null}
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="demo">
            <p className="demo-title">Demo accounts</p>
            <p className="muted small">
              Synthetic data. Pick one to fill the form. The password for all of them is <span className="num">Password123!</span>
            </p>
            <ul className="demo-list">
              {DEMO.map((d) => (
                <li key={d.email}>
                  <button
                    type="button"
                    className="btn btn--quiet"
                    onClick={() => {
                      setEmail(d.email);
                      setPassword('Password123!');
                      setError(null);
                    }}
                  >
                    <strong>{d.label}</strong>
                    <span className="muted small">{d.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
