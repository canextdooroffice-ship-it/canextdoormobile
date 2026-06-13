import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Users, UserPlus, Copy, User, Check, X, Plus, LogIn } from 'lucide-react';

interface Buddy {
  id: string;
  name: string;
  code: string;
  status: 'Online' | 'Offline' | 'Studying';
  completionPercentage: number;
}

interface Group {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  targetHours: number;
  currentHours: number;
  members: string[];
  owner: string;
}

interface StudyBuddyProps {
  userId: string;
  userFullName: string;
  userEmail: string;
  progressState: any;
  subjectGroups: Record<string, 'Group 1' | 'Group 2'>;
  onBack: () => void;
}

export const StudyBuddy: React.FC<StudyBuddyProps> = ({
  userId,
  userFullName,
  userEmail,
  progressState,
  subjectGroups,
  onBack,
}) => {
  // Generate deterministic share code
  const userShareCode = useMemo(() => {
    let base = 'STUDENT';
    if (userFullName) {
      base = userFullName.replace(/\s+/g, '').substring(0, 4).toUpperCase();
    } else if (userEmail) {
      base = userEmail.split('@')[0].substring(0, 4).toUpperCase();
    }
    const suffix = userId ? userId.substring(userId.length - 4).toUpperCase() : '2026';
    return `CA-${base}${suffix}`;
  }, [userId, userFullName, userEmail]);

  // Calculate user's weighted completion percentage
  const userCompletionPercentage = useMemo(() => {
    if (!progressState) return 0;
    const subjects = Object.keys(progressState);
    if (subjects.length === 0) return 0;

    let totalWeightedPoints = 0;
    let totalWeight = 0;

    subjects.forEach(subName => {
      const chaptersObj = progressState[subName];
      if (!chaptersObj) return;

      const chapters = Object.keys(chaptersObj);
      if (chapters.length === 0) return;

      // Calculate subject progress points
      let completedPoints = 0;
      const totalPoints = chapters.length * 4; // 1 (Class) + 3 (Revisions)

      chapters.forEach(chap => {
        const status = chaptersObj[chap];
        if (status) {
          if (status.classDone) completedPoints++;
          completedPoints += Math.min(status.revisionCycle, 3);
        }
      });

      const subProgress = totalPoints > 0 ? (completedPoints / totalPoints) : 0;

      // Determine weight
      const group = subjectGroups[subName];
      let weight = 1.0; // No Group default
      if (group === 'Group 1') {
        weight = 1.5;
      } else if (group === 'Group 2') {
        weight = 1.5;
      }

      totalWeightedPoints += subProgress * weight;
      totalWeight += weight;
    });

    if (totalWeight === 0) return 0;
    return Math.round((totalWeightedPoints / totalWeight) * 100);
  }, [progressState, subjectGroups]);

  // Tabs: 'buddies' | 'groups'
  const [activeTab, setActiveTab] = useState<'buddies' | 'groups'>('buddies');

  // Friends / Buddies state
  const [buddies, setBuddies] = useState<Buddy[]>(() => {
    try {
      const raw = localStorage.getItem('cand_study_buddies_v2');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Groups state
  const [groups, setGroups] = useState<Group[]>(() => {
    try {
      const raw = localStorage.getItem('cand_study_groups_v2');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Action / Form states
  const [buddyCodeInput, setBuddyCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Group Form states
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupCodeInput, setGroupCodeInput] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTarget, setNewGroupTarget] = useState('24');

  // Add Member Modal State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState<Group | null>(null);
  const [selectedBuddyToAdd, setSelectedBuddyToAdd] = useState('');
  const [manualMemberCode, setManualMemberCode] = useState('');

  // Study Room State
  const [activeStudyRoom, setActiveStudyRoom] = useState<Group | null>(null);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('cand_study_buddies_v2', JSON.stringify(buddies));
  }, [buddies]);

  useEffect(() => {
    localStorage.setItem('cand_study_groups_v2', JSON.stringify(groups));
  }, [groups]);

  // Get members ranked by completion percentage
  const rankedMembers = useMemo(() => {
    if (!activeStudyRoom) return [];
    
    return activeStudyRoom.members.map(memberName => {
      let score = 0;
      if (memberName === 'You') {
        score = userCompletionPercentage;
      } else {
        // Look up in buddies
        const buddy = buddies.find(b => b.name === memberName);
        if (buddy) {
          score = buddy.completionPercentage;
        } else {
          // Deterministic fallback based on name character codes
          let hash = 0;
          for (let i = 0; i < memberName.length; i++) {
            hash = memberName.charCodeAt(i) + ((hash << 5) - hash);
          }
          score = 30 + (Math.abs(hash) % 61); // 30% to 90%
        }
      }
      
      // Look up status if buddy
      let status: 'Online' | 'Offline' | 'Studying' = 'Online';
      if (memberName === 'You') {
        status = 'Online';
      } else {
        const buddy = buddies.find(b => b.name === memberName);
        if (buddy) {
          status = buddy.status;
        }
      }

      return {
        name: memberName,
        score,
        status
      };
    }).sort((a, b) => b.score - a.score);
  }, [activeStudyRoom, buddies, userCompletionPercentage]);

  // Helper: Show toast notification
  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Copy Code to Clipboard
  const handleCopyCode = () => {
    navigator.clipboard.writeText(userShareCode);
    setCopied(true);
    showToastMsg('Share code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Add Buddy
  const handleAddBuddy = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = buddyCodeInput.trim().toUpperCase();

    if (!cleanCode) return;
    if (cleanCode === userShareCode) {
      showToastMsg("You can't add yourself as a buddy!");
      return;
    }

    // Check if already added
    if (buddies.some(b => b.code === cleanCode)) {
      showToastMsg('This buddy is already in your list!');
      return;
    }

    // Resolve name deterministically based on code
    const namePart = cleanCode.replace('CA-', '').substring(0, 4);
    const nameMapping: Record<string, string> = {
      'KARA': 'Karan Mehta',
      'DIVY': 'Divya Nair',
      'AMIT': 'Amit Shah',
      'PRER': 'Prerna Sen',
      'VIKR': 'Vikram Rao',
      'SIDD': 'Siddharth Jain'
    };
    const resolvedName = nameMapping[namePart] || (namePart.length > 0 
      ? `${namePart.charAt(0) + namePart.substring(1).toLowerCase()} Sharma` 
      : 'Study Buddy');

    const newBuddy: Buddy = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      name: resolvedName,
      code: cleanCode,
      status: Math.random() > 0.4 ? 'Studying' : 'Online',
      completionPercentage: Math.floor(Math.random() * 71) + 25
    };

    setBuddies(prev => [newBuddy, ...prev]);
    setBuddyCodeInput('');
    showToastMsg(`Added buddy: ${resolvedName}! 🤝`);
  };

  // Remove Buddy
  const handleRemoveBuddy = (id: string, name: string) => {
    setBuddies(prev => prev.filter(b => b.id !== id));
    showToastMsg(`Removed buddy: ${name}`);
  };


  // Create Group
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    const target = parseFloat(newGroupTarget) || 24;

    if (!name) return;

    const code = 'GRP-' + name.replace(/\s+/g, '').substring(0, 8).toUpperCase();
    const newGroup: Group = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      name,
      code,
      memberCount: 1,
      targetHours: target,
      currentHours: 0,
      members: ['You'],
      owner: 'You'
    };

    setGroups(prev => [newGroup, ...prev]);
    setNewGroupName('');
    setNewGroupTarget('24');
    setIsCreateGroupOpen(false);
    showToastMsg(`Created study group: ${name}! 🎉`);
  };

  // Join Group
  const handleJoinGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const code = groupCodeInput.trim().toUpperCase();

    if (!code) return;

    // Check if already in group
    const existingGroup = groups.find(g => g.code === code);
    if (existingGroup) {
      if (existingGroup.members.includes('You')) {
        showToastMsg('You are already a member of this group!');
        return;
      }
      // Join existing group
      setGroups(prev => prev.map(g => 
        g.code === code 
          ? { ...g, memberCount: g.memberCount + 1, members: [...g.members, 'You'] }
          : g
      ));
      showToastMsg(`Joined group: ${existingGroup.name}! 🚀`);
    } else {
      // Simulate creating a mock group matching the code entered
      const mockGroupName = code.startsWith('GRP-') ? code.substring(4) : code;
      const newGroup: Group = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        name: `${mockGroupName} Club 📚`,
        code,
        memberCount: Math.floor(Math.random() * 4) + 2,
        targetHours: 24,
        currentHours: 12.5,
        members: ['Chitransh Agrawal', 'Ananya Sharma', 'You'],
        owner: 'Chitransh Agrawal'
      };
      setGroups(prev => [newGroup, ...prev]);
      showToastMsg(`Joined group: ${newGroup.name}! 🚀`);
    }

    setGroupCodeInput('');
    setIsJoinGroupOpen(false);
  };

  // Add Member to Group
  const handleAddMemberToGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddMemberOpen) return;

    let memberName = '';
    if (selectedBuddyToAdd) {
      memberName = selectedBuddyToAdd;
    } else if (manualMemberCode.trim()) {
      const code = manualMemberCode.trim().toUpperCase();
      // Look up in buddies
      const foundBuddy = buddies.find(b => b.code === code);
      if (foundBuddy) {
        memberName = foundBuddy.name;
      } else {
        // Generate name dynamically from code or fallback
        const namePart = code.replace('CA-', '').substring(0, 4);
        const generatedNames: Record<string, string> = {
          'KARA': 'Karan Mehta',
          'DIVY': 'Divya Nair',
          'AMIT': 'Amit Shah',
          'PRER': 'Prerna Sen',
          'VIKR': 'Vikram Rao',
          'SIDD': 'Siddharth Jain'
        };
        memberName = generatedNames[namePart] || `${namePart.charAt(0) + namePart.substring(1).toLowerCase()} Sharma`;
      }
    }

    if (!memberName) return;

    if (isAddMemberOpen.members.includes(memberName)) {
      showToastMsg(`${memberName} is already a member of this group!`);
      return;
    }

    // Add to group
    setGroups(prev => prev.map(g => 
      g.id === isAddMemberOpen.id 
        ? { ...g, memberCount: g.memberCount + 1, members: [...g.members, memberName] }
        : g
    ));

    // Also update activeStudyRoom if it's currently open
    if (activeStudyRoom && activeStudyRoom.id === isAddMemberOpen.id) {
      setActiveStudyRoom(prev => prev ? {
        ...prev,
        memberCount: prev.memberCount + 1,
        members: [...prev.members, memberName]
      } : null);
    }

    showToastMsg(`Added ${memberName} to ${isAddMemberOpen.name}! 👥`);
    setSelectedBuddyToAdd('');
    setManualMemberCode('');
    setIsAddMemberOpen(null);
  };

  // Delete or Leave Group
  const handleDeleteGroup = (id: string, name: string, isOwner: boolean) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    if (activeStudyRoom && activeStudyRoom.id === id) {
      setActiveStudyRoom(null);
    }
    showToastMsg(isOwner ? `Deleted group: ${name}` : `Left group: ${name}`);
  };

  return (
    <div className="study-buddy-container fade-in">
      {/* Toast Notification */}
      {toast && (
        <div className="study-buddy-toast">
          <span>{toast}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="study-buddy-header-bar">
        <button 
          type="button" 
          className="study-buddy-back-btn" 
          onClick={activeStudyRoom ? () => setActiveStudyRoom(null) : onBack}
          aria-label="Back"
        >
          <ArrowLeft size={16} />
          <span>{activeStudyRoom ? 'Exit Leaderboard' : 'Tools'}</span>
        </button>
        <h2 className="study-buddy-header-title">
          {activeStudyRoom ? 'Leaderboard' : 'Study Buddy'}
        </h2>
      </div>

      {activeStudyRoom ? (
        /* ==================== STUDY ROOM VIEW ==================== */
        <div className="study-room-layout fade-in">
          {/* Header Card */}
          <div className="room-info-card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(6, 182, 212, 0.1))', color: 'var(--text-primary)', border: '1.5px solid var(--border-color)', boxShadow: 'none' }}>
            <span className="room-badge" style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}>GROUP LEADERBOARD</span>
            <h3 className="room-title">{activeStudyRoom.name}</h3>
            <p className="room-desc" style={{ color: 'var(--text-secondary)' }}>Ranking members based on their weighted completion score across Group 1, Group 2, and No Group subjects.</p>
          </div>

          {/* Weighting Legend Info Box */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Weighted Score Criteria</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Group 1 & 2 Subjects</span>
              <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Weight 1.5</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>No Group Subjects</span>
              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Weight 1.0</span>
            </div>
          </div>

          {/* Members active in room grid */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', marginTop: '8px' }}>
            <h4 className="room-section-title" style={{ margin: 0 }}>Leaderboard Standing</h4>
            {activeStudyRoom.owner === 'You' && (
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(activeStudyRoom)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 6px'
                }}
              >
                <Plus size={12} /> Add Member
              </button>
            )}
          </div>
          <div className="room-members-grid" style={{ gap: '12px' }}>
            {rankedMembers.map((member, index) => {
              const isSelf = member.name === 'You';
              const rank = index + 1;
              let medal = '';
              if (rank === 1) medal = '🥇';
              else if (rank === 2) medal = '🥈';
              else if (rank === 3) medal = '🥉';
              
              return (
                <div key={member.name} className="room-member-card" style={{ border: isSelf ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-color)', backgroundColor: isSelf ? 'rgba(99, 102, 241, 0.03)' : 'var(--bg-card)', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontStyle: 'normal', fontSize: '14px', width: '24px', display: 'flex', justifyContent: 'center', fontWeight: 800, color: rank <= 3 ? 'inherit' : 'var(--text-muted)' }}>
                      {medal || `#${rank}`}
                    </div>
                    <div className="member-avatar-wrapper">
                      <div className="member-avatar" style={{ backgroundColor: rank === 1 ? 'var(--accent-gold)' : 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: 800, width: '36px', height: '36px' }}>
                        {member.name.charAt(0)}
                      </div>
                      <span className={`status-dot ${member.status === 'Studying' ? 'studying' : member.status === 'Online' ? 'online' : 'offline'}`} />
                    </div>
                    <div className="member-info" style={{ marginLeft: '6px', display: 'flex', flexDirection: 'column' }}>
                      <span className="member-name" style={{ fontWeight: isSelf ? 800 : 700, fontSize: '13px', color: 'var(--text-primary)' }}>{member.name} {isSelf && '(You)'}</span>
                      <span className="member-activity" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {member.status === 'Studying' ? 'Studying right now' : member.status === 'Online' ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{member.score}%</span>
                    <div style={{ width: '60px', height: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${member.score}%`, height: '100%', backgroundColor: rank === 1 ? 'var(--accent-gold)' : 'var(--accent-primary)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ==================== BUDDIES & GROUPS HOME ==================== */
        <>
          {/* Top Tabs */}
          <div className="study-buddy-tabs">
            <button 
              type="button"
              className={`tab-btn ${activeTab === 'buddies' ? 'active' : ''}`}
              onClick={() => setActiveTab('buddies')}
            >
              Buddies
            </button>
            <button 
              type="button"
              className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
              onClick={() => setActiveTab('groups')}
            >
              Study Groups
            </button>
          </div>

          {activeTab === 'buddies' ? (
            /* ==================== BUDDIES TAB ==================== */
            <div className="buddies-tab-content fade-in">
              {/* Share Code Display */}
              <div className="share-code-card">
                <div className="share-left">
                  <span className="share-label">YOUR UNIQUE STUDY CODE</span>
                  <span className="share-code">{userShareCode}</span>
                </div>
                <button 
                  type="button" 
                  onClick={handleCopyCode}
                  className={`share-copy-btn ${copied ? 'copied' : ''}`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Add Buddy Form */}
              <form onSubmit={handleAddBuddy} className="add-buddy-form">
                <input 
                  type="text" 
                  placeholder="Enter Buddy Code (e.g. CA-CHIT99)" 
                  value={buddyCodeInput}
                  onChange={(e) => setBuddyCodeInput(e.target.value)}
                  className="add-buddy-input"
                  maxLength={15}
                  required
                />
                <button type="submit" className="add-buddy-submit-btn">
                  <UserPlus size={16} />
                  <span>Add Buddy</span>
                </button>
              </form>

              {/* Buddies list */}
              <h4 className="list-title-header">Your Study Buddies ({buddies.length})</h4>
              <div className="buddies-list">
                {buddies.length === 0 ? (
                  <div className="buddies-empty">
                    <User size={32} className="empty-icon" />
                    <p>No buddies added yet. Share your code to study together!</p>
                  </div>
                ) : (
                  buddies.map(buddy => {
                    const statusClass = buddy.status.toLowerCase();
                    return (
                      <div key={buddy.id} className="buddy-card">
                        <div className="buddy-card-left">
                          <div className={`buddy-avatar ${statusClass}`}>
                            {buddy.name.charAt(0)}
                          </div>
                          <div className="buddy-details">
                            <span className="buddy-name">{buddy.name}</span>
                            <span className="buddy-code-tag">{buddy.code}</span>
                          </div>
                        </div>
                        <div className="buddy-card-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                            {buddy.completionPercentage}% Complete
                          </span>
                          <button 
                            type="button" 
                            className="buddy-action-btn remove"
                            onClick={() => handleRemoveBuddy(buddy.id, buddy.name)}
                            title="Remove Buddy"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ==================== GROUPS TAB ==================== */
            <div className="groups-tab-content fade-in">
              
              {/* Group Action Buttons */}
              <div className="group-actions-header">
                <button 
                  type="button" 
                  onClick={() => setIsJoinGroupOpen(true)}
                  className="group-header-btn join"
                >
                  <LogIn size={15} /> Join Group
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="group-header-btn create"
                >
                  <Plus size={15} /> Create Group
                </button>
              </div>

              {/* Group List */}
              <h4 className="list-title-header">Your Study Groups ({groups.length})</h4>
              <div className="groups-list">
                {groups.length === 0 ? (
                  <div className="groups-empty">
                    <Users size={32} className="empty-icon" />
                    <p>You aren't in any study groups. Join or create one to coordinate targets!</p>
                  </div>
                ) : (
                  groups.map(group => {
                    const ratio = Math.min(100, Math.round((group.currentHours / group.targetHours) * 100));
                    return (
                      <div key={group.id} className="group-card">
                        <div className="group-card-header-row">
                          <div className="group-info">
                            <span className="group-title">{group.name}</span>
                            <span className="group-code-badge">Code: {group.code}</span>
                            <span className="group-owner-badge" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                              {group.owner === 'You' ? '👑 Owner: You' : `👤 Owner: ${group.owner}`}
                            </span>
                          </div>
                          <div className="group-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="members-count">
                              <Users size={12} />
                              {group.memberCount} members
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(group.id, group.name, group.owner === 'You')}
                              className="buddy-action-btn remove"
                              style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title={group.owner === 'You' ? "Delete Group" : "Leave Group"}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="group-progress-section">
                          <div className="progress-labels">
                            <span>Today's Study Progress</span>
                            <span>{group.currentHours}h / {group.targetHours}h</span>
                          </div>
                          <div className="group-progress-bar-bg">
                            <div className="group-progress-bar-fill" style={{ width: `${ratio}%` }} />
                          </div>
                        </div>

                        {/* Card actions */}
                        <div className="group-card-actions" style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button 
                            type="button" 
                            onClick={() => setActiveStudyRoom(group)}
                            className="group-join-room-btn"
                            style={{ flex: 1 }}
                          >
                            <Users size={12} />
                            <span>View Leaderboard</span>
                          </button>
                          {group.owner === 'You' && (
                            <button
                              type="button"
                              onClick={() => setIsAddMemberOpen(group)}
                              className="group-add-member-btn"
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '4px',
                                border: '1.5px solid var(--accent-primary)',
                                background: 'transparent',
                                color: 'var(--accent-primary)',
                                padding: '8px 12px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <Plus size={12} />
                              <span>Add Member</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* JOIN GROUP MODAL SHEET */}
              {isJoinGroupOpen && createPortal(
                <div className="buddy-modal-overlay" onClick={() => setIsJoinGroupOpen(false)}>
                  <div className="buddy-modal-sheet" onClick={(e) => e.stopPropagation()}>
                    <div className="buddy-modal-header">
                      <h3>Join Study Group</h3>
                      <button type="button" className="close-btn" onClick={() => setIsJoinGroupOpen(false)}>
                        <X size={18} />
                      </button>
                    </div>
                    <form onSubmit={handleJoinGroup} className="buddy-modal-form">
                      <div className="form-group">
                        <label>Group Code</label>
                        <input 
                          type="text" 
                          placeholder="e.g. GRP-WARRIORS" 
                          value={groupCodeInput}
                          onChange={(e) => setGroupCodeInput(e.target.value)}
                          className="styled-buddy-input"
                          required
                        />
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="submit-btn">Join Group</button>
                        <button type="button" className="cancel-btn" onClick={() => setIsJoinGroupOpen(false)}>Cancel</button>
                      </div>
                    </form>
                  </div>
                </div>,
                document.body
              )}

              {/* CREATE GROUP MODAL SHEET */}
              {isCreateGroupOpen && createPortal(
                <div className="buddy-modal-overlay" onClick={() => setIsCreateGroupOpen(false)}>
                  <div className="buddy-modal-sheet" onClick={(e) => e.stopPropagation()}>
                    <div className="buddy-modal-header">
                      <h3>Create Study Group</h3>
                      <button type="button" className="close-btn" onClick={() => setIsCreateGroupOpen(false)}>
                        <X size={18} />
                      </button>
                    </div>
                    <form onSubmit={handleCreateGroup} className="buddy-modal-form">
                      <div className="form-group">
                        <label>Group Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Audit Study Club" 
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="styled-buddy-input"
                          maxLength={30}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Daily Study Target Hours (Group Total)</label>
                        <input 
                          type="number" 
                          placeholder="e.g. 24" 
                          value={newGroupTarget}
                          onChange={(e) => setNewGroupTarget(e.target.value)}
                          className="styled-buddy-input"
                          min={1}
                          max={200}
                          required
                        />
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="submit-btn">Create Group</button>
                        <button type="button" className="cancel-btn" onClick={() => setIsCreateGroupOpen(false)}>Cancel</button>
                      </div>
                    </form>
                  </div>
                </div>,
                document.body
              )}

              {/* ADD MEMBER MODAL SHEET */}
              {isAddMemberOpen && createPortal(
                <div className="buddy-modal-overlay" onClick={() => { setIsAddMemberOpen(null); setSelectedBuddyToAdd(''); setManualMemberCode(''); }}>
                  <div className="buddy-modal-sheet" onClick={(e) => e.stopPropagation()}>
                    <div className="buddy-modal-header">
                      <h3>Add Member to Group</h3>
                      <button type="button" className="close-btn" onClick={() => { setIsAddMemberOpen(null); setSelectedBuddyToAdd(''); setManualMemberCode(''); }}>
                        <X size={18} />
                      </button>
                    </div>
                    <form onSubmit={handleAddMemberToGroup} className="buddy-modal-form">
                      <div className="form-group">
                        <label>Select from Study Buddies</label>
                        {buddies.filter(b => !isAddMemberOpen.members.includes(b.name)).length === 0 ? (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0' }}>No eligible buddies to add. All your buddies are already in this group, or you have no buddies added.</p>
                        ) : (
                          <select 
                            value={selectedBuddyToAdd} 
                            onChange={(e) => {
                              setSelectedBuddyToAdd(e.target.value);
                              if (e.target.value) setManualMemberCode(''); // Clear manual input
                            }}
                            className="styled-buddy-input"
                            style={{ width: '100%', height: '42px', padding: '8px 12px' }}
                          >
                            <option value="">-- Choose a Buddy --</option>
                            {buddies
                              .filter(b => !isAddMemberOpen.members.includes(b.name))
                              .map(b => (
                                <option key={b.id} value={b.name}>
                                  {b.name} ({b.code})
                                </option>
                              ))
                            }
                          </select>
                        )}
                      </div>
                      
                      <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, margin: '4px 0' }}>— OR —</div>

                      <div className="form-group">
                        <label>Enter Member Code Manually</label>
                        <input 
                          type="text" 
                          placeholder="e.g. CA-KARA12" 
                          value={manualMemberCode}
                          onChange={(e) => {
                            setManualMemberCode(e.target.value);
                            if (e.target.value) setSelectedBuddyToAdd(''); // Clear selection
                          }}
                          className="styled-buddy-input"
                          maxLength={15}
                        />
                      </div>

                      <div className="form-actions">
                        <button type="submit" className="submit-btn" disabled={!selectedBuddyToAdd && !manualMemberCode.trim()}>Add Member</button>
                        <button type="button" className="cancel-btn" onClick={() => { setIsAddMemberOpen(null); setSelectedBuddyToAdd(''); setManualMemberCode(''); }}>Cancel</button>
                      </div>
                    </form>
                  </div>
                </div>,
                document.body
              )}

            </div>
          )}
        </>
      )}
    </div>
  );
};
