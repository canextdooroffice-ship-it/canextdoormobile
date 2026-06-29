import React from 'react';
import { LogOut, ShieldAlert, Settings, Briefcase, Clock, Layers, Copy, CheckCircle, Calendar, Lock, Eye, EyeOff, Bell } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { CustomSelect } from './CustomSelect';

interface ProfileProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  userEmail: string;
  caLevel: string;
  setCaLevel: (level: string) => void;
  studyTarget: number;
  setStudyTarget: (target: number) => void;
  onLogout: () => void;
  fullName: string;
  onUpdateFullName: (name: string) => void;
  examStartDate: string;
  onUpdateExamStartDate: (date: string) => void;
  preparingFor: 'Group 1' | 'Group 2' | 'Both Groups';
  onUpdatePreparingFor: (val: 'Group 1' | 'Group 2' | 'Both Groups') => void;
  studyRemindersEnabled: boolean;
  onToggleStudyReminders: (enabled: boolean) => void;
}

export const Profile: React.FC<ProfileProps> = ({
  showToast,
  userEmail,
  caLevel,
  setCaLevel,
  onLogout,
  studyTarget: studyTargetProp,
  setStudyTarget,
  fullName: fullNameProp,
  onUpdateFullName,
  examStartDate: examStartDateProp,
  onUpdateExamStartDate,
  preparingFor: preparingForProp,
  onUpdatePreparingFor,
  studyRemindersEnabled,
  onToggleStudyReminders,
}) => {
  // Load initial values from localStorage
  const getStoredValue = (key: string, fallback: string) => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  };

  const [fullName, setFullName] = React.useState(() => fullNameProp || getStoredValue('cand_fullName', ''));
  const [studyTarget, setLocalStudyTarget] = React.useState(() => {
    const val = getStoredValue('cand_studyTarget', '');
    return val ? parseInt(val, 10) : studyTargetProp;
  });
  const [courseLevel, setCourseLevel] = React.useState(() => getStoredValue('cand_courseLevel', caLevel));
  const [preparingFor, setPreparingFor] = React.useState<'Group 1' | 'Group 2' | 'Both Groups'>(
    () => preparingForProp || getStoredValue('cand_preparingFor', 'Both Groups') as 'Group 1' | 'Group 2' | 'Both Groups'
  );
  const [attemptMonthYear, setAttemptMonthYear] = React.useState(() => getStoredValue('cand_attemptMonthYear', ''));
  const [examStartDate, setExamStartDate] = React.useState(() => examStartDateProp || getStoredValue('cand_examStartDate', ''));

  const [articleshipStartDate, setArticleshipStartDate] = React.useState(() => getStoredValue('cand_articleshipStartDate', ''));
  const [allowedLeaves, setAllowedLeaves] = React.useState(() => parseInt(getStoredValue('cand_allowedLeaves', '0'), 10));
  const [leavesTaken, setLeavesTaken] = React.useState(() => parseInt(getStoredValue('cand_leavesTaken', '0'), 10));

  // Password Update states
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [showPass, setShowPass] = React.useState(false);
  const [pwLoading, setPwLoading] = React.useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      showToast('Please enter a new password.', 'warning');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters long.', 'warning');
      return;
    }

    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast('Password updated successfully! 🔐', 'success');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (err: any) {
      showToast(err.message || 'An unexpected error occurred.', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  // Notification state and handler
  const [notifPermission, setNotifPermission] = React.useState<string>(() => 
    ('Notification' in window) ? Notification.permission : 'unsupported'
  );

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showToast('Notifications are not supported on this device/browser.', 'warning');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === 'granted') {
        showToast('Notifications enabled successfully! 🔔', 'success');
      } else if (permission === 'denied') {
        showToast('Notifications blocked. Enable them in your browser settings.', 'warning');
      }
    } catch (err) {
      showToast('Failed to request notification permission.', 'error');
    }
  };

  const [prevCaLevel, setPrevCaLevel] = React.useState(caLevel);
  if (caLevel !== prevCaLevel) {
    setPrevCaLevel(caLevel);
    setCourseLevel(caLevel);
  }

  const [prevExamStartDate, setPrevExamStartDate] = React.useState(examStartDateProp);
  if (examStartDateProp !== prevExamStartDate) {
    setPrevExamStartDate(examStartDateProp);
    setExamStartDate(examStartDateProp || '');
  }

  const [prevFullName, setPrevFullName] = React.useState(fullNameProp);
  if (fullNameProp !== prevFullName) {
    setPrevFullName(fullNameProp);
    setFullName(fullNameProp || '');
  }

  const [prevStudyTarget, setPrevStudyTarget] = React.useState(studyTargetProp);
  if (studyTargetProp !== prevStudyTarget) {
    setPrevStudyTarget(studyTargetProp);
    setLocalStudyTarget(studyTargetProp);
  }

  const [prevPreparingFor, setPrevPreparingFor] = React.useState(preparingForProp);
  if (preparingForProp !== prevPreparingFor) {
    setPrevPreparingFor(preparingForProp);
    setPreparingFor(preparingForProp);
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('cand_fullName', fullName);
      localStorage.setItem('cand_courseLevel', courseLevel);
      localStorage.setItem('cand_preparingFor', preparingFor);
      localStorage.setItem('cand_attemptMonthYear', attemptMonthYear);
      localStorage.setItem('cand_examStartDate', examStartDate);
      localStorage.setItem('cand_studyTarget', studyTarget.toString());

      localStorage.setItem('cand_articleshipStartDate', articleshipStartDate);
      localStorage.setItem('cand_allowedLeaves', allowedLeaves.toString());
      localStorage.setItem('cand_leavesTaken', leavesTaken.toString());

      // Sync level and name back to the app root
      setCaLevel(courseLevel);
      onUpdateFullName(fullName);
      onUpdateExamStartDate(examStartDate);
      setStudyTarget(studyTarget);
      onUpdatePreparingFor(preparingFor);

      showToast('Profile updated successfully! ✨', 'success');
    } catch (err) {
      console.warn('Failed to save profile changes:', err);
      showToast('Failed to save changes.', 'error');
    }
  };

  const handleCancel = () => {
    setFullName(getStoredValue('cand_fullName', fullNameProp || ''));
    setLocalStudyTarget(parseInt(getStoredValue('cand_studyTarget', studyTargetProp.toString()), 10));
    setCourseLevel(getStoredValue('cand_courseLevel', caLevel));
    setPreparingFor(preparingForProp || getStoredValue('cand_preparingFor', 'Both Groups') as 'Group 1' | 'Group 2' | 'Both Groups');
    setAttemptMonthYear(getStoredValue('cand_attemptMonthYear', ''));
    setExamStartDate(getStoredValue('cand_examStartDate', examStartDateProp || ''));

    setArticleshipStartDate(getStoredValue('cand_articleshipStartDate', ''));
    setAllowedLeaves(parseInt(getStoredValue('cand_allowedLeaves', '0'), 10));
    setLeavesTaken(parseInt(getStoredValue('cand_leavesTaken', '0'), 10));
    showToast('Changes reverted.', 'info');
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showToast(`Error signing out: ${error.message}`, 'error');
    } else {
      onLogout();
    }
  };

  // Dynamic calculations for Articleship Record
  const timeElapsed = React.useMemo(() => {
    if (!articleshipStartDate) return '0y 0m';
    const start = new Date(articleshipStartDate);
    const now = new Date();
    if (isNaN(start.getTime())) return '0y 0m';

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }
    return `${years}y ${months}m`;
  }, [articleshipStartDate]);

  const balanceLeaves = Math.max(0, allowedLeaves - leavesTaken);
  
  const utilization = React.useMemo(() => {
    if (allowedLeaves <= 0) return 0;
    return Math.min(100, Math.round((leavesTaken / allowedLeaves) * 100));
  }, [allowedLeaves, leavesTaken]);

  return (
    <div className="profile-redesign-container fade-in">
      {/* Page Header */}
      <div className="welcome-banner">
        <div>
          <span className="level-badge">Your Account</span>
          <h2 className="welcome-title">Profile</h2>
          <p className="welcome-subtitle">Manage your settings and preferences.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="profile-redesign-form">
        {/* SECTION 1: Personal Information */}
        <div className="profile-section-card">
          <div className="profile-section-header purple">
            <div className="section-icon-badge purple">
              <Settings size={18} />
            </div>
            <h3 className="section-header-title">Personal Information</h3>
          </div>

          <div className="profile-form-grid">
            <div className="input-group">
              <label>Full Name</label>
              <input 
                type="text" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                className="styled-text-input-field" 
                placeholder="Full Name"
                required
              />
            </div>

            <div className="input-group">
              <label>Email ID</label>
              <input 
                type="email" 
                value={userEmail} 
                className="styled-text-input-field" 
                disabled
                readOnly
              />
            </div>
          </div>

          <div className="profile-form-grid mt-3">
            <div className="input-group">
              <label>Course Level</label>
              <CustomSelect
                value={courseLevel}
                onChange={setCourseLevel}
                options={[
                  { value: 'Foundation', label: 'CA Foundation' },
                  { value: 'Intermediate', label: 'CA Intermediate' },
                  { value: 'Final', label: 'CA Final' }
                ]}
                className="styled-select-field"
              />
            </div>

            <div className="input-group">
              <label>Attempt Month/Year</label>
              <input 
                type="text" 
                value={attemptMonthYear} 
                onChange={(e) => setAttemptMonthYear(e.target.value)}
                className="styled-text-input-field" 
                placeholder="e.g. May 2026"
                required
              />
            </div>
          </div>

          <div className="input-group mt-3">
            <label>Preparing For</label>
            <div className="segmented-selector-pill">
              <button
                type="button"
                className={`selector-pill-btn ${preparingFor === 'Group 1' ? 'active' : ''}`}
                onClick={() => setPreparingFor('Group 1')}
              >
                <Layers size={13} className="pill-icon" />
                <span>Group 1</span>
              </button>
              <button
                type="button"
                className={`selector-pill-btn ${preparingFor === 'Group 2' ? 'active' : ''}`}
                onClick={() => setPreparingFor('Group 2')}
              >
                <Layers size={13} className="pill-icon" />
                <span>Group 2</span>
              </button>
              <button
                type="button"
                className={`selector-pill-btn ${preparingFor === 'Both Groups' ? 'active' : ''}`}
                onClick={() => setPreparingFor('Both Groups')}
              >
                <Copy size={13} className="pill-icon" />
                <span>Both Groups</span>
              </button>
            </div>
          </div>

          <div className="input-group mt-3 relative">
            <label>Exam Start Date</label>
            <div className="date-input-wrapper">
              <input 
                type="date" 
                value={examStartDate} 
                onChange={(e) => setExamStartDate(e.target.value)}
                className="styled-date-input-field" 
                required
              />
              <Calendar size={14} className="date-field-icon" />
            </div>
          </div>
        </div>

        {/* SECTION 2: Articleship Configuration */}
        <div className="profile-section-card">
          <div className="profile-section-header cyan">
            <div className="section-icon-badge cyan">
              <Briefcase size={18} />
            </div>
            <h3 className="section-header-title">Articleship Configuration</h3>
          </div>

          <div className="input-group">
            <label>Articleship Start Date</label>
            <div className="date-input-wrapper">
              <input 
                type="date" 
                value={articleshipStartDate} 
                onChange={(e) => setArticleshipStartDate(e.target.value)}
                className="styled-date-input-field" 
              />
              <Calendar size={14} className="date-field-icon" />
            </div>
          </div>

          <div className="profile-form-grid mt-3">
            <div className="input-group">
              <label>Allowed Leaves</label>
              <input 
                type="number" 
                value={allowedLeaves} 
                onChange={(e) => setAllowedLeaves(Math.max(0, parseInt(e.target.value) || 0))}
                className="styled-text-input-field"
                min="0"
              />
            </div>

            <div className="input-group">
              <label>Leaves Taken</label>
              <input 
                type="number" 
                value={leavesTaken} 
                onChange={(e) => setLeavesTaken(Math.max(0, parseInt(e.target.value) || 0))}
                className="styled-text-input-field"
                min="0"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="profile-action-buttons-row mt-4">
            <button type="submit" className="profile-save-btn">
              <span>Save Profile Changes</span>
              <CheckCircle size={15} />
            </button>
            <button type="button" onClick={handleCancel} className="profile-cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      </form>

      {/* SECTION 3: Articleship Record Card */}
      <div className="profile-section-card">
        <div className="profile-section-header green">
          <div className="section-icon-badge green">
            <Clock size={18} />
          </div>
          <h3 className="section-header-title">Articleship Record</h3>
        </div>

        <div className="articleship-record-card">
          <div className="record-stat-row">
            <span className="record-stat-label">Time Elapsed</span>
            <span className="record-stat-value">{timeElapsed}</span>
          </div>
          <div className="record-stat-row">
            <span className="record-stat-label">Balance Leaves</span>
            <span className={`record-stat-value ${balanceLeaves <= 0 ? 'alert-red' : ''}`}>
              {balanceLeaves} Days
            </span>
          </div>
          
          <div className="record-divider-line" />

          <div className="record-stat-row" style={{ marginTop: '10px' }}>
            <span className="record-stat-label">Utilization</span>
            <span className="record-stat-value utilization-purple">{utilization}%</span>
          </div>

          <div className="record-progress-bar-wrap">
            <div className="record-progress-bar-bg">
              <div 
                className="record-progress-bar-fill" 
                style={{ width: `${utilization}%` }}
              />
            </div>
          </div>
        </div>

        <p className="articleship-record-hint-note">
          Keep your articleship dates updated to accurately track your remaining leaves and plan your exam preparations effectively.
        </p>
      </div>

      {/* SECTION: Notification Settings */}
      <div className="profile-section-card">
        <div className="profile-section-header purple">
          <div className="section-icon-badge purple">
            <Bell size={18} />
          </div>
          <h3 className="section-header-title">System Notifications</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '14px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Level-Wise Alerts</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: '1.4' }}>
                Receive immediate alerts on mobile when new <strong>{caLevel}</strong> papers are uploaded.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '14px' }}>
            <div style={{ textAlign: 'left', flex: 1, paddingRight: '12px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Study Reminders (Every 2 Hours)</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: '1.4' }}>
                Receive local notifications every 2 hours to keep you focused and hit your study goals.
              </div>
            </div>
            <div className="toggle-switch-container">
              <label className="switch-label-wrap" style={{ position: 'relative', display: 'inline-block', width: '42px', height: '24px' }}>
                <input
                  type="checkbox"
                  checked={studyRemindersEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    if (enabled && notifPermission !== 'granted') {
                      requestNotificationPermission().then(() => {
                        if (Notification.permission === 'granted') {
                          onToggleStudyReminders(true);
                        } else {
                          onToggleStudyReminders(false);
                        }
                      });
                    } else {
                      onToggleStudyReminders(enabled);
                    }
                  }}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: studyRemindersEnabled ? 'var(--accent-primary)' : '#cbd5e1',
                  transition: '0.3s',
                  borderRadius: '24px'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px', width: '18px',
                    left: studyRemindersEnabled ? '20px' : '4px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    transition: '0.3s',
                    borderRadius: '50%'
                  }} />
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginTop: '4px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Status</span>
            <span style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              backgroundColor: notifPermission === 'granted' ? 'rgba(34, 197, 94, 0.15)' : notifPermission === 'denied' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: notifPermission === 'granted' ? '#22c55e' : notifPermission === 'denied' ? '#ef4444' : '#f59e0b'
            }}>
              {notifPermission === 'granted' ? 'Enabled' : notifPermission === 'denied' ? 'Blocked' : 'Not Requested'}
            </span>
          </div>

          {notifPermission !== 'granted' && (
            <button
              type="button"
              onClick={requestNotificationPermission}
              className="profile-save-btn"
              style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
            >
              <span>Enable PWA Notifications</span>
              <Bell size={15} />
            </button>
          )}

          {notifPermission === 'granted' && (
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'left', margin: '4px 0 0 4px', lineHeight: '1.4' }}>
              ℹ️ Notifications are active. You will receive updates relevant to your level: <strong>CA {caLevel}</strong>.
            </p>
          )}
        </div>
      </div>

      {/* SECTION: Account Security */}
      <div className="profile-section-card">
        <div className="profile-section-header orange">
          <div className="section-icon-badge orange">
            <Lock size={18} />
          </div>
          <h3 className="section-header-title">Account Security</h3>
        </div>

        <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="input-group">
            <label htmlFor="newPassword">New Password</label>
            <div className="input-wrapper" style={{ position: 'relative' }}>
              <Lock className="input-icon" size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="newPassword"
                type={showPass ? 'text' : 'password'}
                placeholder="Enter new password (min. 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="styled-text-input-field"
                required
                style={{ paddingLeft: '38px', paddingRight: '40px', boxSizing: 'border-box', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="confirmNewPassword">Confirm New Password</label>
            <div className="input-wrapper" style={{ position: 'relative' }}>
              <Lock className="input-icon" size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="confirmNewPassword"
                type={showPass ? 'text' : 'password'}
                placeholder="Confirm your new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="styled-text-input-field"
                required
                style={{ paddingLeft: '38px', boxSizing: 'border-box', width: '100%' }}
              />
            </div>
          </div>

          <div className="profile-action-buttons-row mt-3">
            <button type="submit" className="profile-save-btn" disabled={pwLoading} style={{ width: '100%', justifyContent: 'center' }}>
              {pwLoading ? (
                <span className="spinner" style={{ width: '14px', height: '14px' }}></span>
              ) : (
                <>
                  <span>Update Password</span>
                  <CheckCircle size={15} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Account / Security Section (Danger Zone) */}
      <div className="profile-section-card danger-zone">
        <button type="button" onClick={handleSignOut} className="profile-logout-btn">
          <LogOut size={16} />
          <span>Sign Out of Account</span>
        </button>
        <div className="profile-pwa-license">
          <ShieldAlert size={12} className="license-icon" />
          <span>CA Next Door</span>
        </div>
      </div>
    </div>
  );
};
