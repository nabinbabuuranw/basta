import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from './lib/router';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/ui';
import App from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode><RouterProvider><AuthProvider><ToastProvider><App /></ToastProvider></AuthProvider></RouterProvider></StrictMode>,
);
