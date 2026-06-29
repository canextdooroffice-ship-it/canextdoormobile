import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Users, UserPlus, Copy, User, Check, X, Plus, LogIn, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { CustomSelect } from './CustomSelect';

interface Buddy {
  id: string;
  name: string;
  code: string;
  status: 'Online' | 'Offline' | 'Studying';
  completionPercentage: number;
  todayHours?: number;
  preparingFor?: 'Group 1' | 'Group 2' | 'Both Groups';
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
  ownerId?: string;
}

interface StudyBuddyProps {
  userId: string;
  userFullName: string;
  userEmail: string;
  progressState: any;
  subjectGroups: Record<string, 'Group 1' | 'Group 2'>;
  onBack: () => void;
  isAdmin?: boolean;
  todayHours: number;
  groups: Group[];
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  preparingFor: 'Group 1' | 'Group 2' | 'Both Groups';
  timerRunning?: boolean;
  buddies: Buddy[];
  setBuddies: React.Dispatch<React.SetStateAction<Buddy[]>>;
  allUsersProgress: any[];
  setAllUsersProgress: React.Dispatch<React.SetStateAction<any[]>>;
}

// Helper: Calculate progress percentage based on unweighted average (only for Group 1/2 subjects)
export const calculateWeightedProgress = (progressState: any, fallbackSubjectGroups: any): number => {
  if (!progressState) return 0;

  // Extract checklist and subjectGroups from the packed cloud state if present
  const actualProgress = progressState.checklist ? progressState.checklist : progressState;
  const actualSubjectGroups = progressState.subjectGroups ? progressState.subjectGroups : fallbackSubjectGroups;
  const hiddenSubs = progressState.hiddenSubjects ? progressState.hiddenSubjects : [];

  const subjects = Object.keys(actualProgress);
  if (subjects.length === 0) return 0;

  let totalPercentage = 0;
  let count = 0;

  subjects.forEach(subName => {
    if (hiddenSubs.includes(subName)) {
      return; // Ignore this subject if it is hidden
    }
    // Only include subjects that have an assigned group ('Group 1' or 'Group 2')
    const group = actualSubjectGroups ? actualSubjectGroups[subName] : null;
    if (group !== 'Group 1' && group !== 'Group 2') {
      return; // Ignore this subject completely
    }

    const chaptersObj = actualProgress[subName];
    if (!chaptersObj) return;

    const chapters = Object.keys(chaptersObj);
    if (chapters.length === 0) return;

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

    totalPercentage += subProgress * 100;
    count++;
  });

  if (count === 0) return 0;
  return Math.round(totalPercentage / count);
};

// Helper: Calculate buddy online/offline/studying status based on last sync updated_at
export const calculateBuddyStatus = (
  isActive: boolean,
  updatedAtStr: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  progressState: any
): 'Online' | 'Offline' | 'Studying' => {
  if (!isActive) return 'Offline';
  if (!updatedAtStr) return 'Offline';

  const lastSync = new Date(updatedAtStr).getTime();
  const now = Date.now();
  const diffMinutes = (now - lastSync) / 60000;

  // Accept clock skew: if the client's clock is behind the server clock (negative diffMinutes),
  // allow up to 15 minutes of skew. Anything further in the future or older than 8 minutes is Offline.
  if (diffMinutes >= -15 && diffMinutes < 8) {
    const actualState = progressState?.checklist ? progressState : progressState;
    const isTimerRunning =
      actualState &&
      typeof actualState === 'object' &&
      (actualState.timerRunning === true || actualState.checklist?.timerRunning === true);
    return isTimerRunning ? 'Studying' : 'Online';
  }
  return 'Offline';
};

export const StudyBuddy: React.FC<StudyBuddyProps> = ({
  userId,
  userFullName,
  userEmail,
  progressState,
  subjectGroups,
  onBack,
  isAdmin = false,
  todayHours,
  groups,
  setGroups,
  preparingFor,
  timerRunning = false,
  buddies,
  setBuddies,
  allUsersProgress,
  setAllUsersProgress,
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
    return calculateWeightedProgress(progressState, subjectGroups);
  }, [progressState, subjectGroups]);

  // Tabs: 'buddies' | 'groups'
  const [activeTab, setActiveTab] = useState<'buddies' | 'groups'>('buddies');

  // Helper: Get members from Supabase who have joined the group code
  const getMembersForGroup = (groupCode: string) => {
    const members: {
      userId: string;
      name: string;
      email: string;
      todayHours: number;
      completionPercentage: number;
      preparingFor: 'Group 1' | 'Group 2' | 'Both Groups';
      status: 'Online' | 'Offline' | 'Studying';
    }[] = [];

    allUsersProgress.forEach(user => {
      const progressState = user.progress_state;
      if (!progressState) return;

      let userGroups: any[] = [];
      if (typeof progressState === 'object') {
        userGroups = (progressState as any).groups || (progressState as any).checklist?.groups || [];
      }

      const hasGroup = Array.isArray(userGroups) && userGroups.some((g: any) => g.code === groupCode);
      if (hasGroup) {
        const completion = calculateWeightedProgress(progressState, subjectGroups);

        const cloudState = progressState;
        let uTodayHours = 0;
        if (cloudState && typeof cloudState === 'object') {
          if ('todayHours' in cloudState) {
            uTodayHours = (cloudState as any).todayHours || 0;
          }
        }

        let uPreparingFor: 'Group 1' | 'Group 2' | 'Both Groups' = 'Both Groups';
        if (cloudState && typeof cloudState === 'object') {
          if ('preparingFor' in cloudState) {
            uPreparingFor = (cloudState as any).preparingFor || 'Both Groups';
          }
        }

        members.push({
          userId: user.user_id,
          name: user.full_name || user.email || 'Study Buddy',
          email: user.email || '',
          todayHours: uTodayHours,
          completionPercentage: completion,
          preparingFor: uPreparingFor,
          status: calculateBuddyStatus(user.is_active, user.updated_at, user.progress_state)
        });
      }
    });

    return members;
  };

  // Helper: Construct complete group members list (combining DB and local/invited members)
  const getGroupMembers = (group: Group) => {
    const dbMembers = getMembersForGroup(group.code);
    const finalMembers: {
      name: string;
      isSelf: boolean;
      todayHours: number;
      completionPercentage: number;
      preparingFor: 'Group 1' | 'Group 2' | 'Both Groups';
      status: 'Online' | 'Offline' | 'Studying';
    }[] = [];

    const processedNames = new Set<string>();

    dbMembers.forEach(m => {
      const isSelfUser = m.userId === userId;
      const displayName = isSelfUser ? 'You' : m.name;
      finalMembers.push({
        name: displayName,
        isSelf: isSelfUser,
        todayHours: isSelfUser ? todayHours : m.todayHours,
        completionPercentage: isSelfUser ? userCompletionPercentage : m.completionPercentage,
        preparingFor: isSelfUser ? preparingFor : m.preparingFor,
        status: isSelfUser ? (timerRunning ? 'Studying' : 'Online') : m.status
      });
      processedNames.add(displayName.toLowerCase());
      processedNames.add(m.name.toLowerCase());
    });

    if (!processedNames.has('you') && !processedNames.has('you (you)')) {
      finalMembers.push({
        name: 'You',
        isSelf: true,
        todayHours: todayHours,
        completionPercentage: userCompletionPercentage,
        preparingFor: preparingFor,
        status: timerRunning ? 'Studying' : 'Online'
      });
      processedNames.add('you');
    }

    if (Array.isArray(group.members)) {
      group.members.forEach(memberName => {
        if (memberName === 'You') return;
        const normalized = memberName.toLowerCase();
        if (processedNames.has(normalized)) return;

        const buddy = buddies.find(b => b.name.toLowerCase() === normalized);
        if (buddy) {
          finalMembers.push({
            name: buddy.name,
            isSelf: false,
            todayHours: buddy.todayHours || 0,
            completionPercentage: buddy.completionPercentage,
            preparingFor: buddy.preparingFor || 'Both Groups',
            status: buddy.status
          });
        } else {
          let hash = 0;
          for (let i = 0; i < memberName.length; i++) {
            hash = memberName.charCodeAt(i) + ((hash << 5) - hash);
          }
          const mockHours = (Math.abs(hash) % 4) + 1.5;
          const mockProgress = 30 + (Math.abs(hash) % 61);
          const mockPreparingFor: ('Group 1' | 'Group 2' | 'Both Groups')[] = ['Group 1', 'Group 2', 'Both Groups'];
          
          finalMembers.push({
            name: memberName,
            isSelf: false,
            todayHours: parseFloat(mockHours.toFixed(1)),
            completionPercentage: mockProgress,
            preparingFor: mockPreparingFor[Math.abs(hash) % 3],
            status: 'Offline'
          });
        }
        processedNames.add(normalized);
      });
    }

    return finalMembers;
  };

  // Dynamically calculate group's current study hours
  const getGroupCurrentHours = (group: Group) => {
    const members = getGroupMembers(group);
    const total = members.reduce((sum, m) => sum + m.todayHours, 0);
    return parseFloat(total.toFixed(1));
  };

  // Dynamically calculate group's member count
  const getGroupMemberCount = (group: Group) => {
    return getGroupMembers(group).length;
  };

  // Action / Form states
  const [buddyCodeInput, setBuddyCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Helper: Show toast notification
  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };


  // Local state for buddy search
  const [buddySearchQuery, setBuddySearchQuery] = useState('');

  // Leaderboard filter state (Group 1, Group 2, Both Groups, All)
  const [leaderboardFilter, setLeaderboardFilter] = useState<'All' | 'Group 1' | 'Group 2' | 'Both Groups'>('All');


  // Memoized filtered buddies list
  const filteredBuddiesList = useMemo(() => {
    if (!buddySearchQuery.trim()) return buddies;
    const query = buddySearchQuery.toLowerCase().trim();
    return buddies.filter(buddy => 
      buddy.name.toLowerCase().includes(query) || 
      buddy.code.toLowerCase().includes(query)
    );
  }, [buddies, buddySearchQuery]);

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

  // Function to manually refresh buddies from Supabase with visual indicators
  const fetchLatestBuddiesInfo = async () => {
    setRefreshing(true);
    showToastMsg('Refreshing buddies progress...');

    try {
      let query = supabase
        .from('user_progress')
        .select('user_id, full_name, email, progress_state, is_active, updated_at');

      if (!isAdmin) {
        const buddyIds = buddies.map(b => b.id);
        const targetUserIds = [userId, ...buddyIds].filter(Boolean);

        const memberNames = new Set<string>();
        groups.forEach(g => {
          if (Array.isArray(g.members)) {
            g.members.forEach(m => {
              if (m && m !== 'You') {
                memberNames.add(m);
              }
            });
          }
        });

        if (memberNames.size > 0) {
          const conditions = [`user_id.in.(${targetUserIds.join(',')})`];
          memberNames.forEach(name => {
            const safeName = name.replace(/,/g, '');
            conditions.push(`full_name.ilike.${safeName}`);
            conditions.push(`email.ilike.${safeName}`);
          });
          query = query.or(conditions.join(','));
        } else {
          query = query.in('user_id', targetUserIds);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      const fetchedData = data || [];
      setAllUsersProgress(fetchedData);
      setBuddies(prev => prev.map(buddy => {
        const match = fetchedData.find(row => row.user_id === buddy.id);
        if (match) {
          const name = match.full_name || match.email || buddy.name;
          const completion = calculateWeightedProgress(match.progress_state, subjectGroups);
          const status = calculateBuddyStatus(match.is_active, match.updated_at, match.progress_state);
          const cloudState = match.progress_state;
          let bTodayHours = 0;
          if (cloudState && typeof cloudState === 'object' && 'todayHours' in cloudState) {
            bTodayHours = (cloudState as any).todayHours || 0;
          }
          let bPreparingFor: 'Group 1' | 'Group 2' | 'Both Groups' = 'Both Groups';
          if (cloudState && typeof cloudState === 'object' && 'preparingFor' in cloudState) {
            bPreparingFor = (cloudState as any).preparingFor || 'Both Groups';
          }
          return {
            ...buddy,
            name,
            completionPercentage: completion,
            status,
            todayHours: bTodayHours,
            preparingFor: bPreparingFor
          };
        } else {
          // Dynamic mock buddy status update on refresh
          const rand = Math.random();
          const status = rand > 0.7 ? 'Studying' : (rand > 0.4 ? 'Online' : 'Offline');
          return {
            ...buddy,
            status
          };
        }
      }));
      showToastMsg('Buddies progress updated! 🔄');
    } catch (err) {
      console.warn('Failed to update buddies from Supabase:', err);
      showToastMsg('Refresh failed. Try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // On mount, randomize mock buddy statuses for visual flavor
  useEffect(() => {
    setBuddies(prev => prev.map(buddy => {
      // If it's a real buddy (exists in allUsersProgress), keep it. Otherwise randomize.
      const isReal = allUsersProgress.some(row => row.user_id === buddy.id);
      if (!isReal) {
        const rand = Math.random();
        const status = rand > 0.7 ? 'Studying' : (rand > 0.4 ? 'Online' : 'Offline');
        return { ...buddy, status };
      }
      return buddy;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-add all active users if the current user is an admin
  useEffect(() => {
    if (!isAdmin || allUsersProgress.length === 0) return;

    setBuddies(prev => {
      const existingIds = new Set(prev.map(b => b.id));
      const newBuddies: Buddy[] = [];
      const updatedBuddiesMap = new Map(prev.map(b => [b.id, b]));

      allUsersProgress.forEach(row => {
        // Skip the admin's own ID
        if (row.user_id === userId) return;

        const completion = calculateWeightedProgress(row.progress_state, subjectGroups);
        const name = row.full_name || row.email || 'Study Buddy';
        const status = calculateBuddyStatus(row.is_active, row.updated_at, row.progress_state);
        const cloudState = row.progress_state;
        let bTodayHours = 0;
        if (cloudState && typeof cloudState === 'object' && 'todayHours' in cloudState) {
          bTodayHours = (cloudState as any).todayHours || 0;
        }
        let bPreparingFor: 'Group 1' | 'Group 2' | 'Both Groups' = 'Both Groups';
        if (cloudState && typeof cloudState === 'object' && 'preparingFor' in cloudState) {
          bPreparingFor = (cloudState as any).preparingFor || 'Both Groups';
        }

        let baseCode = 'STUDENT';
        if (row.full_name) {
          baseCode = row.full_name.replace(/\s+/g, '').substring(0, 4).toUpperCase();
        } else if (row.email) {
          baseCode = row.email.split('@')[0].substring(0, 4).toUpperCase();
        }
        const suffix = row.user_id ? row.user_id.substring(row.user_id.length - 4).toUpperCase() : '2026';
        const code = `CA-${baseCode}${suffix}`;

        if (existingIds.has(row.user_id)) {
          // Update properties of existing buddy
          const existing = updatedBuddiesMap.get(row.user_id);
          if (existing) {
            updatedBuddiesMap.set(row.user_id, {
              ...existing,
              name,
              completionPercentage: completion,
              status,
              todayHours: bTodayHours,
              preparingFor: bPreparingFor
            });
          }
        } else {
          newBuddies.push({
            id: row.user_id,
            name,
            code,
            status,
            completionPercentage: completion,
            todayHours: bTodayHours,
            preparingFor: bPreparingFor
          });
        }
      });

      if (newBuddies.length > 0) {
        setTimeout(() => showToastMsg(`Automatically added ${newBuddies.length} active users as buddies! 🤝`), 0);
      }

      const updatedExisting = prev.map(b => updatedBuddiesMap.get(b.id) || b);
      return [...newBuddies, ...updatedExisting];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, userId, subjectGroups, allUsersProgress]);



  // Get members ranked by completion percentage
  const rankedMembers = useMemo(() => {
    if (!activeStudyRoom) return [];
    
    let members = getGroupMembers(activeStudyRoom);
    if (leaderboardFilter !== 'All') {
      members = members.filter(m => m.preparingFor === leaderboardFilter);
    }
    
    return members.map(m => ({
      name: m.name,
      score: m.completionPercentage,
      status: m.status,
      preparingFor: m.preparingFor,
      todayHours: m.todayHours
    })).sort((a, b) => b.score - a.score);
  }, [activeStudyRoom, allUsersProgress, buddies, userCompletionPercentage, preparingFor, todayHours, leaderboardFilter]);



  // Copy Code to Clipboard
  const handleCopyCode = () => {
    navigator.clipboard.writeText(userShareCode);
    setCopied(true);
    showToastMsg('Share code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Add Buddy
  const handleAddBuddy = async (e: React.FormEvent) => {
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

    // Resolve name deterministically or query Supabase
    const withoutPrefix = cleanCode.replace('CA-', '');
    const base = withoutPrefix.substring(0, 4);
    const suffix = withoutPrefix.substring(4);

    let resolvedName = '';
    let resolvedId = '';
    let resolvedProgress = 0;
    let resolvedStatus: 'Online' | 'Offline' | 'Studying' = 'Online';
    let resolvedTodayHours = 0;
    let resolvedPreparingFor: 'Group 1' | 'Group 2' | 'Both Groups' = 'Both Groups';
    let isActualUser = false;

    showToastMsg('Searching for buddy on server...');

    try {
      if (base.length >= 3) {
        // Query database
        const { data, error } = await supabase
          .from('user_progress')
          .select('user_id, full_name, email, progress_state, is_active, updated_at')
          .or(`full_name.ilike.${base}%,email.ilike.${base}%`);

        if (error) throw error;

        if (data && data.length > 0) {
          const suffixLower = suffix.toLowerCase();
          const match = data.find(row => {
            const rowUserId = row.user_id || '';
            return rowUserId.toLowerCase().endsWith(suffixLower);
          });

          if (match) {
            resolvedId = match.user_id;
            resolvedName = match.full_name || match.email || 'Study Buddy';
            resolvedProgress = calculateWeightedProgress(match.progress_state, subjectGroups);
            resolvedStatus = calculateBuddyStatus(match.is_active, match.updated_at, match.progress_state);
            const cloudState = match.progress_state;
            if (cloudState && typeof cloudState === 'object' && 'todayHours' in cloudState) {
              resolvedTodayHours = (cloudState as any).todayHours || 0;
            }
            if (cloudState && typeof cloudState === 'object' && 'preparingFor' in cloudState) {
              resolvedPreparingFor = (cloudState as any).preparingFor || 'Both Groups';
            }
            isActualUser = true;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to find user in Supabase, falling back to mock:', err);
    }

    if (!isActualUser) {
      const nameMapping: Record<string, string> = {
        'KARA': 'Karan Mehta',
        'DIVY': 'Divya Nair',
        'AMIT': 'Amit Shah',
        'PRER': 'Prerna Sen',
        'VIKR': 'Vikram Rao',
        'SIDD': 'Siddharth Jain'
      };
      resolvedName = nameMapping[base] || (base.length > 0 
        ? `${base.charAt(0) + base.substring(1).toLowerCase()} Sharma` 
        : 'Study Buddy');
      resolvedId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
      resolvedProgress = Math.floor(Math.random() * 71) + 25;
      const rand = Math.random();
      resolvedStatus = rand > 0.7 ? 'Studying' : (rand > 0.4 ? 'Online' : 'Offline');
      resolvedTodayHours = parseFloat((Math.random() * 4 + 1.5).toFixed(1));
      
      const preparingForOptions: ('Group 1' | 'Group 2' | 'Both Groups')[] = ['Group 1', 'Group 2', 'Both Groups'];
      resolvedPreparingFor = preparingForOptions[base.length % 3];
      
      showToastMsg(`Buddy code not found on server. Added mock buddy: ${resolvedName}! 🤝`);
    } else {
      showToastMsg(`Added actual buddy: ${resolvedName}! 🤝`);
    }

    const newBuddy: Buddy = {
      id: resolvedId,
      name: resolvedName,
      code: cleanCode,
      status: resolvedStatus,
      completionPercentage: resolvedProgress,
      todayHours: resolvedTodayHours,
      preparingFor: resolvedPreparingFor
    };

    setBuddies(prev => [newBuddy, ...prev]);
    setBuddyCodeInput('');
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

    const randomSuffix = Math.floor(Math.random() * 900 + 100);
    const code = 'GRP-' + name.replace(/\s+/g, '').substring(0, 8).toUpperCase() + randomSuffix;
    const newGroup: Group = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      name,
      code,
      memberCount: 1,
      targetHours: target,
      currentHours: 0,
      members: ['You'],
      owner: userFullName || 'Study Buddy',
      ownerId: userId
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
      showToastMsg('You are already a member of this group!');
      return;
    }

    // Verify code on server
    let foundGroupInDb: any = null;
    for (const user of allUsersProgress) {
      const progressState = user.progress_state;
      if (!progressState) continue;
      let userGroups: any[] = [];
      if (typeof progressState === 'object') {
        userGroups = (progressState as any).groups || (progressState as any).checklist?.groups || [];
      }
      if (Array.isArray(userGroups)) {
        const match = userGroups.find((g: any) => g.code === code);
        if (match) {
          foundGroupInDb = match;
          break;
        }
      }
    }

    if (!foundGroupInDb) {
      showToastMsg('Group code not found on server! Please check the code.');
      return;
    }

    // Join the group by copying its details
    const newGroup: Group = {
      id: foundGroupInDb.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
      name: foundGroupInDb.name,
      code: foundGroupInDb.code,
      memberCount: (foundGroupInDb.memberCount || 1) + 1,
      targetHours: foundGroupInDb.targetHours || 24,
      currentHours: foundGroupInDb.currentHours || 0,
      members: Array.isArray(foundGroupInDb.members) ? [...foundGroupInDb.members, 'You'] : ['You'],
      owner: foundGroupInDb.owner || 'Study Buddy',
      ownerId: foundGroupInDb.ownerId || foundGroupInDb.owner
    };

    setGroups(prev => [newGroup, ...prev]);
    showToastMsg(`Joined group: ${newGroup.name}! 🚀`);
    setGroupCodeInput('');
    setIsJoinGroupOpen(false);
  };

  // Add Member to Group
  const handleAddMemberToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddMemberOpen) return;

    let memberName = '';
    let isActualUser = false;

    if (selectedBuddyToAdd) {
      memberName = selectedBuddyToAdd;
    } else if (manualMemberCode.trim()) {
      const code = manualMemberCode.trim().toUpperCase();
      // Look up in buddies first
      const foundBuddy = buddies.find(b => b.code === code);
      if (foundBuddy) {
        memberName = foundBuddy.name;
      } else {
        // Query Supabase for this member
        const withoutPrefix = code.replace('CA-', '');
        const base = withoutPrefix.substring(0, 4);
        const suffix = withoutPrefix.substring(4);
        
        try {
          if (base.length >= 3) {
            const { data, error } = await supabase
              .from('user_progress')
              .select('user_id, full_name, email')
              .or(`full_name.ilike.${base}%,email.ilike.${base}%`);

            if (error) throw error;

            if (data && data.length > 0) {
              const suffixLower = suffix.toLowerCase();
              const match = data.find(row => {
                const rowUserId = row.user_id || '';
                return rowUserId.toLowerCase().endsWith(suffixLower);
              });

              if (match) {
                memberName = match.full_name || match.email || 'Study Buddy';
                isActualUser = true;
              }
            }
          }
        } catch (err) {
          console.warn('Failed to find member in Supabase:', err);
        }

        if (!isActualUser) {
          // Fallback to deterministic name
          const nameMapping: Record<string, string> = {
            'KARA': 'Karan Mehta',
            'DIVY': 'Divya Nair',
            'AMIT': 'Amit Shah',
            'PRER': 'Prerna Sen',
            'VIKR': 'Vikram Rao',
            'SIDD': 'Siddharth Jain'
          };
          memberName = nameMapping[base] || (base.length > 0
            ? `${base.charAt(0) + base.substring(1).toLowerCase()} Sharma`
            : 'Study Buddy');
        }
      }
    }

    if (!memberName) return;

    const currentMembers = getGroupMembers(isAddMemberOpen).map(m => m.name.toLowerCase());
    if (currentMembers.includes(memberName.toLowerCase())) {
      showToastMsg(`${memberName} is already a member of this group!`);
      return;
    }

    // Add to group
    setGroups(prev => prev.map(g => 
      g.id === isAddMemberOpen.id 
        ? { ...g, members: [...g.members, memberName] }
        : g
    ));

    // Also update activeStudyRoom if it's currently open
    if (activeStudyRoom && activeStudyRoom.id === isAddMemberOpen.id) {
      setActiveStudyRoom(prev => prev ? {
        ...prev,
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
      setLeaderboardFilter('All');
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
          onClick={activeStudyRoom ? () => { setActiveStudyRoom(null); setLeaderboardFilter('All'); } : onBack}
          aria-label="Back"
        >
          <ArrowLeft size={16} />
          <span>{activeStudyRoom ? 'Exit Leaderboard' : 'Tools'}</span>
        </button>
        <h2 className="study-buddy-header-title">
          {activeStudyRoom ? 'Leaderboard' : 'Study Buddy'}
        </h2>
        <button
          type="button"
          className="study-buddy-refresh-btn"
          onClick={fetchLatestBuddiesInfo}
          disabled={refreshing}
          aria-label="Refresh buddies"
          title="Refresh buddies"
        >
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      {activeStudyRoom ? (
        /* ==================== STUDY ROOM VIEW ==================== */
        <div className="study-room-layout fade-in">
          {/* Header Card */}
          <div className="room-info-card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(6, 182, 212, 0.1))', color: 'var(--text-primary)', border: '1.5px solid var(--border-color)', boxShadow: 'none' }}>
            <span className="room-badge" style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}>GROUP LEADERBOARD</span>
            <h3 className="room-title">{activeStudyRoom.name}</h3>
            <p className="room-desc" style={{ color: 'var(--text-secondary)' }}>Ranking members based on their average completion percentage across Group 1 and Group 2 subjects.</p>
          </div>



          {/* Members active in room grid */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', marginTop: '8px' }}>
            <h4 className="room-section-title" style={{ margin: 0 }}>Leaderboard Standing</h4>
            {activeStudyRoom.ownerId === userId && (
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

          {/* Group-wise Bifurcation Toggles */}
          <div className="study-buddy-tabs" style={{ marginBottom: '12px', marginTop: '6px' }}>
            {(['All', 'Group 1', 'Group 2', 'Both Groups'] as const).map(filterOpt => (
              <button 
                key={filterOpt}
                type="button"
                className={`tab-btn ${leaderboardFilter === filterOpt ? 'active' : ''}`}
                onClick={() => setLeaderboardFilter(filterOpt)}
                style={{ 
                  fontSize: '11px', 
                  padding: '6px 2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {filterOpt}
              </button>
            ))}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span className="member-name" style={{ fontWeight: isSelf ? 800 : 700, fontSize: '13px', color: 'var(--text-primary)' }}>{member.name} {isSelf && '(You)'}</span>
                        {member.preparingFor && (
                          <span className={`preparing-badge ${member.preparingFor.toLowerCase().replace(' ', '-')}`} style={{
                            fontSize: '8px',
                            fontWeight: 800,
                            padding: '1px 4px',
                            borderRadius: '4px',
                            backgroundColor: member.preparingFor === 'Group 1' ? 'rgba(99, 102, 241, 0.15)' : member.preparingFor === 'Group 2' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: member.preparingFor === 'Group 1' ? 'var(--accent-primary)' : member.preparingFor === 'Group 2' ? 'var(--accent-secondary)' : 'var(--accent-green)'
                          }}>
                            {member.preparingFor}
                          </span>
                        )}
                      </div>
                      <span className="member-activity" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {member.status === 'Studying' ? 'Studying right now' : member.status === 'Online' ? 'Online' : 'Offline'}
                        {typeof member.todayHours === 'number' && ` • ${member.todayHours}h today`}
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
            {rankedMembers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No members found preparing for {leaderboardFilter}.
              </div>
            )}
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
              <div className="search-bar-wrapper" style={{ margin: '16px 0 12px 0', position: 'relative' }}>
                <Search size={16} className="search-bar-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search buddies by name or code..."
                  value={buddySearchQuery}
                  onChange={(e) => setBuddySearchQuery(e.target.value)}
                  className="search-bar-input"
                />
              </div>

              <h4 className="list-title-header">Your Study Buddies ({filteredBuddiesList.length})</h4>
              <div className="buddies-list">
                {filteredBuddiesList.length === 0 ? (
                  <div className="buddies-empty">
                    <User size={32} className="empty-icon" />
                    <p>
                      {buddySearchQuery.trim()
                        ? 'No buddies match your search.'
                        : 'No buddies added yet. Share your code to study together!'}
                    </p>
                  </div>
                ) : (
                  filteredBuddiesList.map(buddy => {
                    const statusClass = buddy.status.toLowerCase();
                    return (
                      <div key={buddy.id} className="buddy-card">
                        <div className="buddy-card-left">
                          <div className={`buddy-avatar ${statusClass}`}>
                            {buddy.name.charAt(0)}
                          </div>
                          <div className="buddy-details">
                            <span className="buddy-name">{buddy.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                              <span className="buddy-code-tag">{buddy.code}</span>
                              {buddy.preparingFor && (
                                <span className={`preparing-badge ${buddy.preparingFor.toLowerCase().replace(' ', '-')}`} style={{
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: '6px',
                                  backgroundColor: buddy.preparingFor === 'Group 1' ? 'rgba(99, 102, 241, 0.15)' : buddy.preparingFor === 'Group 2' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                  color: buddy.preparingFor === 'Group 1' ? 'var(--accent-primary)' : buddy.preparingFor === 'Group 2' ? 'var(--accent-secondary)' : 'var(--accent-green)'
                                }}>
                                  {buddy.preparingFor}
                                </span>
                              )}
                            </div>
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
                    const groupCurrentHours = getGroupCurrentHours(group);
                    const memberCount = getGroupMemberCount(group);
                    const ratio = Math.min(100, Math.round((groupCurrentHours / group.targetHours) * 100));
                    const isOwner = group.ownerId === userId || group.owner === 'You';
                    return (
                      <div key={group.id} className="group-card">
                        <div className="group-card-header-row">
                          <div className="group-info">
                            <span className="group-title">{group.name}</span>
                            <span className="group-code-badge">Code: {group.code}</span>
                            <span className="group-owner-badge" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                              {isOwner ? '👑 Owner: You' : `👤 Owner: ${group.owner}`}
                            </span>
                          </div>
                          <div className="group-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="members-count">
                              <Users size={12} />
                              {memberCount} members
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(group.id, group.name, isOwner)}
                              className="buddy-action-btn remove"
                              style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title={isOwner ? "Delete Group" : "Leave Group"}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="group-progress-section">
                          <div className="progress-labels">
                            <span>Today's Study Progress</span>
                            <span>{groupCurrentHours}h / {group.targetHours}h</span>
                          </div>
                          <div className="group-progress-bar-bg">
                            <div className="group-progress-bar-fill" style={{ width: `${ratio}%` }} />
                          </div>
                        </div>

                        {/* Card actions */}
                        <div className="group-card-actions" style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button 
                            type="button" 
                            onClick={() => {
                              setActiveStudyRoom(group);
                              setLeaderboardFilter('All');
                            }}
                            className="group-join-room-btn"
                            style={{ flex: 1 }}
                          >
                            <Users size={12} />
                            <span>View Leaderboard</span>
                          </button>
                          {isOwner && (
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
                        {(() => {
                          const currentMembers = getGroupMembers(isAddMemberOpen).map(m => m.name.toLowerCase());
                          const eligibleBuddies = buddies.filter(b => !currentMembers.includes(b.name.toLowerCase()));
                          if (eligibleBuddies.length === 0) {
                            return <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0' }}>No eligible buddies to add. All your buddies are already in this group, or you have no buddies added.</p>;
                          }
                          return (
                            <CustomSelect
                              value={selectedBuddyToAdd}
                              onChange={(val) => {
                                setSelectedBuddyToAdd(val);
                                if (val) setManualMemberCode(''); // Clear manual input
                              }}
                              options={[
                                { value: '', label: '-- Choose a Buddy --' },
                                ...eligibleBuddies.map(b => ({ value: b.name, label: `${b.name} (${b.code})` }))
                              ]}
                              className="styled-buddy-input"
                            />
                          );
                        })()}
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
