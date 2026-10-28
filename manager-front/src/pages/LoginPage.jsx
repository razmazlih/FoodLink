import { notify } from '../components/Feedback/Feedback';
import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const success = await login(email, password);
    setSubmitting(false);
    if (success) {
      navigate(success === 'admin' ? '/dashboard' : '/restaurants');
    } else {
      notify('Login failed or this account does not have management access.');
    }
  };

  return (
    <div className="management-login">
      <section className="login-story">
        <span className="eyebrow">THE BUSINESS SIDE OF GOOD FOOD</span>
        <h1>Great food.<br />Smooth operations.</h1>
        <p>Your restaurants, menus, and orders. One thoughtfully organized workspace.</p>
        <div className="login-story-art" aria-hidden="true"><span>f.</span></div>
        <span className="login-story-caption">FoodLink · Management workspace</span>
      </section>
      <section className="login-panel">
      <span className="eyebrow">WELCOME BACK</span>
      <h2>Let’s get to work.</h2>
      <p>Sign in to your management account.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="manager-email">Email address</label>
        <input
          id="manager-email"
          autoComplete="username"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="manager-password">Password</label>
        <input
          id="manager-password"
          autoComplete="current-password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in to workspace'} <span aria-hidden="true">↗</span></button>
      </form>
      <p className="login-note">For restaurant teams and FoodLink administrators.</p>
      </section>
    </div>
  );
}

export default LoginPage;