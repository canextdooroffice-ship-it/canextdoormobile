import React from 'react';
import { LogOut, ShieldAlert, Settings, Briefcase, Clock, Layers, Copy, CheckCircle, Calendar } from 'lucide-react';
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
    () => getStoredValue('cand_preparingFor', 'Both Groups') as 'Group 1' | 'Group 2' | 'Both Groups'
  );
  const [attemptMonthYear, setAttemptMonthYear] = React.useState(() => getStoredValue('cand_attemptMonthYear', ''));
  const [examStartDate, setExamStartDate] = React.useState(() => examStartDateProp || getStoredValue('cand_examStartDate', ''));

  const [articleshipStartDate, setArticleshipStartDate] = React.useState(() => getStoredValue('cand_articleshipStartDate', ''));
  const [allowedLeaves, setAllowedLeaves] = React.useState(() => parseInt(getStoredValue('cand_allowedLeaves', '0'), 10));
  const [leavesTaken, setLeavesTaken] = React.useState(() => parseInt(getStoredValue('cand_leavesTaken', '0'), 10));

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
    setPreparingFor(getStoredValue('cand_preparingFor', 'Both Groups') as 'Group 1' | 'Group 2' | 'Both Groups');
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
