import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter your email address');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: window.location.origin,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('A password reset link has been sent to your email address! Check your inbox.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (isSignUp) {
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      const isAdminEmail = 
        email.toLowerCase().trim().endsWith('@canextdoor.com') || 
        email.toLowerCase().trim() === 'admin@gmail.com' || 
        email.toLowerCase().trim() === 'chitranshagrawal005@gmail.com';

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            ca_level: 'Foundation', // Default value
            study_hours_target: 6,
            is_admin: isAdminEmail,
          }
        }
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        // If email confirmation is required, inform user. Otherwise log them in.
        if (data.session) {
          onAuthSuccess();
        } else {
          setSuccessMsg('Registration successful! Please check your email for confirmation.');
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        onAuthSuccess();
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-container fade-in">
      <div className="auth-header">
        <div className="brand-logo">
          <img src="/logo.png" alt="CA Next Door Logo" className="brand-logo-img animate-float" />
        </div>
        <h1 className="brand-title">CA Next Door</h1>
        <p className="brand-subtitle">Your Chartered Accountancy Study Partner</p>
      </div>

      <div className="auth-card">
        {isForgotPassword ? (
          <>
            <div className="auth-tabs" style={{ justifyContent: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '8px 0' }}>Reset Password</h2>
            </div>

            <form onSubmit={handleForgotPassword} className="auth-form">
              {errorMsg && (
                <div className="auth-alert error slide-up">
                  <AlertCircle size={18} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="auth-alert success slide-up">
                  <CheckCircle size={18} />
                  <span>{successMsg}</span>
                </div>
              )}

              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4', textAlign: 'center' }}>
                Enter your email address and we'll send you a link to reset your account password.
              </p>

              <div className="input-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    id="email"
                    type="email"
                    placeholder="enter your email..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="spinner"></span>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setIsForgotPassword(false); setErrorMsg(null); setSuccessMsg(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  margin: '16px auto 0 auto',
                  display: 'block'
                }}
              >
                Back to Log In
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="auth-tabs">
              <button 
                type="button" 
                className={`auth-tab-btn ${!isSignUp ? 'active' : ''}`}
                onClick={() => { setIsSignUp(false); setErrorMsg(null); setSuccessMsg(null); }}
              >
                Log In
              </button>
              <button 
                type="button" 
                className={`auth-tab-btn ${isSignUp ? 'active' : ''}`}
                onClick={() => { setIsSignUp(true); setErrorMsg(null); setSuccessMsg(null); }}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
              {errorMsg && (
                <div className="auth-alert error slide-up">
                  <AlertCircle size={18} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="auth-alert success slide-up">
                  <CheckCircle size={18} />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="input-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    id="email"
                    type="email"
                    placeholder="enter your email..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="password" style={{ margin: 0 }}>Password</label>
                  {!isSignUp && (
                    <button 
                      type="button" 
                      onClick={() => { setIsForgotPassword(true); setErrorMsg(null); setSuccessMsg(null); }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div className="input-group slide-up">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <div className="input-wrapper">
                    <Lock className="input-icon" size={18} />
                    <input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="spinner"></span>
                ) : (
                  isSignUp ? 'Create CA Account' : 'Log In'
                )}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="auth-footer-note">
        <p>CA Next Door tracking uses Supabase Authorization to secure student dashboard records.</p>
      </div>
    </div>
  );
};
