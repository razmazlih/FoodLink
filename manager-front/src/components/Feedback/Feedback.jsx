import React, { useEffect, useState } from 'react';

export function notify(message) {
  window.dispatchEvent(new CustomEvent('foodlink-feedback', { detail: String(message) }));
}

export default function Feedback() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const show = (event) => setMessage(event.detail);
    window.addEventListener('foodlink-feedback', show);
    return () => window.removeEventListener('foodlink-feedback', show);
  }, []);
  if (!message) return null;
  return <aside className="workspace-feedback" role="status">
    <span>{message}</span>
    <button type="button" onClick={() => setMessage('')} aria-label="Dismiss notification">×</button>
  </aside>;
}
