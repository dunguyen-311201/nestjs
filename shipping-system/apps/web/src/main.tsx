import { ClerkProvider } from '@clerk/clerk-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

const root = createRoot(document.getElementById('root')!);

if (!publishableKey) {
  root.render(
    <p style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      Missing <code>VITE_CLERK_PUBLISHABLE_KEY</code> — copy{' '}
      <code>.env.example</code> to <code>.env.local</code> and set your Clerk
      publishable key.
    </p>,
  );
} else {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={publishableKey}>
        <App />
      </ClerkProvider>
    </StrictMode>,
  );
}
