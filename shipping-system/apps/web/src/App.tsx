import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from '@clerk/clerk-react';
import { useState } from 'react';

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000';

function TokenPanel() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const [role, setRole] = useState<string>('');

  async function showToken() {
    const t = await getToken();
    setToken(t ?? 'No session token available');
    setCopied(false);
    if (t) {
      try {
        const payload = JSON.parse(atob(t.split('.')[1])) as {
          role?: unknown;
        };
        setRole(typeof payload.role === 'string' ? payload.role : '(none)');
      } catch {
        setRole('(unreadable)');
      }
    }
  }

  async function copyToken() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
  }

  return (
    <section>
      <button onClick={() => void showToken()}>Get session token</button>{' '}
      {role && (
        <span>
          role: <strong>{role}</strong>
        </span>
      )}{' '}
      {token && (
        <button onClick={() => void copyToken()}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      )}
      <pre
        style={{
          background: '#f4f4f4',
          padding: '1rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {token || 'Token expires ~60s after minting — re-fetch as needed'}
      </pre>
    </section>
  );
}

function OrdersPanel() {
  const { getToken, userId } = useAuth();
  const [result, setResult] = useState<string>('');

  async function callApi(withToken: boolean) {
    try {
      const headers: Record<string, string> = {};
      if (withToken) {
        const token = await getToken();
        if (!token) {
          setResult('No session token available');
          return;
        }
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${API_URL}/orders`, { headers });
      const body = await res.text();
      setResult(`HTTP ${res.status}\n${body}`);
    } catch (err) {
      setResult(`Request failed: ${(err as Error).message}`);
    }
  }

  return (
    <section>
      <p>
        Signed in as <strong>{userId}</strong>
      </p>
      <button onClick={() => void callApi(true)}>
        GET /orders (with token)
      </button>{' '}
      <button onClick={() => void callApi(false)}>
        GET /orders (no token)
      </button>
      <pre
        style={{
          background: '#f4f4f4',
          padding: '1rem',
          whiteSpace: 'pre-wrap',
        }}
      >
        {result || 'No request sent yet'}
      </pre>
    </section>
  );
}

export function App() {
  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 640, margin: '2rem auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1>Shipping System</h1>
        <UserButton />
      </header>
      <SignedOut>
        <p>Sign in with Clerk to call the protected API gateway.</p>
        <SignInButton mode="modal" />
      </SignedOut>
      <SignedIn>
        <TokenPanel />
        <OrdersPanel />
      </SignedIn>
    </main>
  );
}
