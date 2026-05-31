import React from 'react';
import { User, LogOut, Award, Target, Star, ShieldAlert } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface ProfileProps {
  userEmail: string;
  caLevel: string;
  setCaLevel: (level: string) => void;
  studyTarget: number;
  setStudyTarget: (target: number) => void;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({
  userEmail,
  caLevel,
  setCaLevel,
  studyTarget,
  setStudyTarget,
  onLogout,
}) => {
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(`Error signing out: ${error.message}`);
    } else {
      onLogout();
    }
  };

  return (
    <div className="profile-container fade-in">
      {/* Profile Header card */}
      <div className="profile-card">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">
            <User size={36} className="profile-avatar-icon" />
          </div>
        </div>
        <h3 className="profile-email">{userEmail}</h3>
        <p className="profile-tagline">Chartered Accountancy Aspirant</p>
      </div>

      {/* Settings Options */}
      <div className="settings-section">
        <h4 className="settings-title">Study Configuration</h4>
        
        {/* CA Level */}
        <div className="settings-card">
          <div className="setting-row">
            <div className="setting-icon-desc">
              <Award className="setting-icon gold" />
              <div>
                <span className="setting-name">CA Level</span>
                <span className="setting-hint">Choose your current target exam</span>
              </div>
            </div>
            <select
              value={caLevel}
              onChange={(e) => setCaLevel(e.target.value)}
              className="settings-select"
            >
              <option value="Foundation">CA Foundation</option>
              <option value="Intermediate">CA Intermediate</option>
              <option value="Final">CA Final</option>
            </select>
          </div>
        </div>

        {/* Daily Study Goal */}
        <div className="settings-card">
          <div className="setting-row">
            <div className="setting-icon-desc">
              <Target className="setting-icon blue" />
              <div>
                <span className="setting-name">Daily Target Hours</span>
                <span className="setting-hint">How many hours do you plan to study?</span>
              </div>
            </div>
            <input
              type="number"
              min="1"
              max="24"
              value={studyTarget}
              onChange={(e) => setStudyTarget(parseInt(e.target.value) || 6)}
              className="settings-num-input"
            />
          </div>
        </div>
      </div>

      {/* Rewards / Badges Section */}
      <div className="rewards-section">
        <h4 className="settings-title">Achievements</h4>
        <div className="badges-grid">
          <div className="badge-item earned">
            <Star className="badge-icon" fill="currentColor" />
            <span className="badge-name">Early Bird</span>
          </div>
          <div className="badge-item earned">
            <Star className="badge-icon" fill="currentColor" />
            <span className="badge-name">7-Day Streak</span>
          </div>
          <div className="badge-item locked">
            <Star className="badge-icon" />
            <span className="badge-name">Centurion (100h)</span>
          </div>
        </div>
      </div>

      {/* Danger Zone / Log out */}
      <div className="settings-section">
        <h4 className="settings-title">Security & Account</h4>
        
        <div className="settings-card logout-trigger" onClick={handleSignOut}>
          <div className="setting-row">
            <div className="setting-icon-desc">
              <LogOut className="setting-icon red" />
              <div>
                <span className="setting-name">Sign Out</span>
                <span className="setting-hint">Log out of your study account</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pwa-info">
          <ShieldAlert size={14} className="pwa-info-icon" />
          <span>CA Next Door v1.0.0. Licensed under local student client cache.</span>
        </div>
      </div>
    </div>
  );
};
