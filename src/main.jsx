import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Register global runtime error and unhandled rejection listeners for debugging
window.addEventListener('error', (event) => {
  console.error(
    `%c[Runtime Error]%c ${event.message || 'An error occurred'}\n` +
    `Source: ${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}\n` +
    `Error Object:`,
    'color: #ef4444; font-weight: bold;', 'color: inherit;',
    event.error || event
  );
});

window.addEventListener('unhandledrejection', (event) => {
  console.error(
    `%c[Unhandled Promise Rejection]%c Reason: ${event.reason?.message || event.reason || 'No reason specified'}\n` +
    `Promise rejection detail:`,
    'color: #ef4444; font-weight: bold;', 'color: inherit;',
    event.reason
  );
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

