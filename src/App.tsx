import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, RotateCcw, X, Timer, CheckCircle, AlertCircle, Info, AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from './supabaseClient';
import { loadFromSupabase, saveToSupabase } from './lib/syncProgress';
import type { Session } from '@supabase/supabase-js';
import { Auth } from './components/Auth';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { Planner } from './components/Planner';
import { Analytics } from './components/Analytics';
import { Profile } from './components/Profile';
import { Subjects } from './components/Subjects';
import { Test } from './components/Test';
import { Tools } from './components/Tools';
import { LinksManager } from './components/LinksManager';
import { TimeManager } from './components/TimeManager';
import { StudyBuddy } from './components/StudyBuddy';
import { Timeline } from './components/Timeline';
import type { TimelinePhase } from './components/Timeline';
import type { TestRecord } from './components/Test';
import { AdminPanel } from './components/AdminPanel';
import type { MockTestPaper } from './constants/mockTests';
import { SYLLABUS_DATA } from './constants/syllabus';
import type { ProgressState } from './components/Subjects';
import type { ScheduleSlot } from './components/Dashboard';
import type { Task, StudyLog } from './components/Planner';
import type { RevisionItem, Mistake } from './components/Analytics';

// ---- localStorage persistence keys ----
const LS_KEYS = {
  PROGRESS: 'cand_progress',
  CA_LEVEL: 'cand_caLevel',
  STUDY_TARGET: 'cand_studyTarget',
  TOTAL_HOURS: 'cand_totalHours',
  FULL_NAME: 'cand_fullName',
  SLOTS: 'cand_schedule_slots',
  TASKS: 'cand_planner_tasks',
  REVISIONS: 'cand_revisions',
  MISTAKES: 'cand_mistakes',
  EXAM_START_DATE: 'cand_examStartDate',
  TODAY_HOURS: 'cand_todayHours',
  TODAY_DATE_KEY: 'cand_todayDateKey',
  STREAK_COUNT: 'cand_streakCount',
  CHECKED_IN_TODAY: 'cand_checkedInToday',
} as const;

const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const saveToStorage = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('localStorage save failed:', err);
  }
};


// Helper to get local date string YYYY-MM-DD
const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Calculate unique activity dates from all logs
const getActivityDates = (
  checkInHistory: string[],
  studyHistory: Record<string, number>,
  wakeHistory: Record<string, string>,
  sleepHistory: Record<string, string>
): string[] => {
  const datesSet = new Set<string>();

  if (checkInHistory && Array.isArray(checkInHistory)) {
    checkInHistory.forEach(d => {
      if (d) datesSet.add(d);
    });
  }

  if (studyHistory) {
    Object.entries(studyHistory).forEach(([d, hours]) => {
      if (hours > 0 && d) {
        datesSet.add(d);
      }
    });
  }

  if (wakeHistory) {
    Object.entries(wakeHistory).forEach(([d, val]) => {
      if (val && val !== 'null' && val !== 'undefined' && d) {
        datesSet.add(d);
      }
    });
  }

  if (sleepHistory) {
    Object.entries(sleepHistory).forEach(([d, val]) => {
      if (val && val !== 'null' && val !== 'undefined' && d) {
        datesSet.add(d);
      }
    });
  }

  return Array.from(datesSet);
};

// TS port of the backend python streak calculation logic
const calculateStreak = (dates: string[]): number => {
  if (!dates || dates.length === 0) return 0;
  
  const uniqueDates = Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  
  const today = new Date();
  const todayStr = getLocalDateString(today);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  
  let streakCount = 0;
  
  if (uniqueDates.includes(todayStr) || uniqueDates.includes(yesterdayStr)) {
    const startDt = uniqueDates.includes(todayStr) ? today : yesterday;
    const curr = new Date(startDt);
    
    while (true) {
      const currStr = getLocalDateString(curr);
      if (uniqueDates.includes(currStr)) {
        streakCount++;
        curr.setDate(curr.getDate() - 1);
      } else {
        break;
      }
    }
  }
  
  return streakCount;
};


const buildInitialProgress = (): ProgressState => {
  const state: ProgressState = {};
  Object.values(SYLLABUS_DATA).forEach((levelSyllabus) => {
    Object.entries(levelSyllabus).forEach(([subName, chapters]) => {
      if (!state[subName]) {
        state[subName] = {};
      }
      chapters.forEach((chap) => {
        state[subName][chap] = {
          classDone: false,
          priority: 'C',
          ldrs: false,
          revisionCycle: 0,
        };
      });
    });
  });
  return state;
};

function App() {
  // One-time migration: clear stale mock streak data from old localStorage keys
  useState(() => {
    try {
      if (!localStorage.getItem('cand_streak_migrated_v1')) {
        localStorage.removeItem('cand_streakCount');
        localStorage.removeItem('cand_checkedInToday');
        localStorage.setItem('cand_streak_migrated_v1', '1');
      }
    } catch { /* ignore */ }
  });

  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<string>('home');
  
  // Password Reset state variables
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<boolean>(false);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPasswordVal, setShowResetPasswordVal] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  // Service Worker Update state
  const [swUpdateWorker, setSwUpdateWorker] = useState<ServiceWorker | null>(null);
  
  // CA Student settings — loaded from localStorage first, then Supabase metadata
  const [caLevel, setCaLevel] = useState<string>(() => loadFromStorage(LS_KEYS.CA_LEVEL, 'Intermediate'));
  const [studyTarget, setStudyTarget] = useState<number>(() => loadFromStorage(LS_KEYS.STUDY_TARGET, 6));
  const [totalHours, setTotalHours] = useState<number>(() => loadFromStorage(LS_KEYS.TOTAL_HOURS, 0));
  const [progressState, setProgressState] = useState<ProgressState>(() =>
    loadFromStorage<ProgressState>(LS_KEYS.PROGRESS, buildInitialProgress())
  );
  const [tests, setTests] = useState<TestRecord[]>(() => loadFromStorage<TestRecord[]>('cand_tests', []));
  const [favouriteQuestions, setFavouriteQuestions] = useState<any[]>(() => loadFromStorage<any[]>('cand_favourite_questions', []));
  const [deletedDefaultSubjects, setDeletedDefaultSubjects] = useState<string[]>(() =>
    loadFromStorage<string[]>('cand_deletedDefaultSubjects', [])
  );
  const [dynamicPapers, setDynamicPapers] = useState<MockTestPaper[]>([]);
  const isAdmin = useMemo(() => {
    if (!session?.user) return false;
    const email = session.user.email?.toLowerCase().trim() || '';
    return (
      session.user.user_metadata?.is_admin === true ||
      email.endsWith('@canextdoor.com') ||
      email === 'admin@gmail.com' ||
      email === 'chitranshagrawal005@gmail.com'
    );
  }, [session]);

  const showLocalNotification = useCallback((title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.showNotification(title, {
            body,
            icon: '/logo.png',
            badge: '/logo.png',
            vibrate: [200, 100, 200],
          } as NotificationOptions & { vibrate?: number[]; badge?: string });
        })
        .catch(() => { new Notification(title, { body }); });
    } else {
      new Notification(title, { body });
    }
  }, []);

  const fetchDynamicPapers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mock_papers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        const mapped: MockTestPaper[] = data.map((row: any) => ({
          id: row.id,
          title: row.title,
          type: row.type,
          totalMarks: row.total_marks,
          questions: row.questions,
          level: row.level,
          subject: row.subject
        } as any));
        setDynamicPapers(mapped);
      }
    } catch (err) {
      console.warn('Failed to fetch dynamic papers:', err);
    }
  }, []);

  // Fetch dynamic papers and listen to realtime updates
  useEffect(() => {
    fetchDynamicPapers();

    const channel = supabase
      .channel('mock_papers_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mock_papers' },
        (payload) => {
          console.log('Realtime change in mock_papers table:', payload);
          if (payload.eventType === 'INSERT' && payload.new) {
            const paper = payload.new;
            const currentLevel = stateRef.current.caLevel;
            if (paper.level && currentLevel && paper.level.toLowerCase() === currentLevel.toLowerCase()) {
              showLocalNotification(
                'New Test Paper Uploaded! 📝',
                `A new ${paper.type} paper for ${paper.subject} is now available: "${paper.title}"`
              );
            }
          }
          fetchDynamicPapers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDynamicPapers, showLocalNotification]);

  const [globalSubjects, setGlobalSubjects] = useState<any[]>([]);

  const fetchGlobalSubjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('global_subjects')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      if (data) {
        const deletedDefaultsRecord = data.find((sub: any) => sub.name === '__deleted_defaults__');
        const deletedDefaultNames = new Set<string>(deletedDefaultsRecord?.chapters || []);
        const actualSubjects = data.filter((sub: any) => sub.name !== '__deleted_defaults__');

        setGlobalSubjects(actualSubjects);
        
        const STATIC_SUBJECT_KEYS = new Set([
          'Paper 1: Financial Reporting',
          'Paper 2: Advanced Financial Management',
          'Paper 3: Advanced Auditing and Assurance',
          'Paper 4: Direct Tax and International Taxation',
          'Paper 5: Indirect Taxation and Customs',
          'Advanced Accounting',
          'Corporate & Other Laws',
          'Taxation (DT & IDT)',
          'Cost & Management Accounting',
          'Principles & Practice of Accounting',
          'Business Laws',
          'Quantitative Aptitude',
          'Business Economics'
        ]);

        // Prune any dynamic subjects that are no longer in Supabase or deleted default subjects
        Object.keys(SYLLABUS_DATA).forEach((levelStr) => {
          const lvl = levelStr as keyof typeof SYLLABUS_DATA;
          Object.keys(SYLLABUS_DATA[lvl]).forEach((subName) => {
            if (deletedDefaultNames.has(subName)) {
              delete (SYLLABUS_DATA[lvl] as any)[subName];
            } else if (!STATIC_SUBJECT_KEYS.has(subName)) {
              delete (SYLLABUS_DATA[lvl] as any)[subName];
            }
          });
        });
        
        // Dynamically merge/overwrite into SYLLABUS_DATA constant
        actualSubjects.forEach((sub: any) => {
          const lvl = sub.level as keyof typeof SYLLABUS_DATA;
          if (SYLLABUS_DATA[lvl]) {
            (SYLLABUS_DATA[lvl] as any)[sub.name] = sub.chapters || [];
          }
        });
      }
    } catch (err) {
      console.warn('Failed to fetch global subjects:', err);
    }
  }, []);

  // Fetch global subjects and listen to realtime updates
  useEffect(() => {
    fetchGlobalSubjects();

    const channel = supabase
      .channel('global_subjects_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_subjects' },
        (payload) => {
          console.log('Realtime change in global_subjects table:', payload);
          fetchGlobalSubjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchGlobalSubjects]);

  // Ensure default subjects and their chapters for current caLevel are initialized in progressState,
  // and prune default subjects and items of other levels, and prune any stale mock chapters.
  useEffect(() => {
    if (caLevel) {
      const levelSyllabus = SYLLABUS_DATA[caLevel as keyof typeof SYLLABUS_DATA];
      if (!levelSyllabus) return;

      const MOCK_CHAPTERS = new Set([
        // Final
        '1. Intro to Ind AS',
        '2. Conceptual Framework',
        '3. Presentation of Ind AS',
        '4. Ind AS 38: Intangible Assets',
        '5. Ind AS 40: Investment Property',
        '1. Security Analysis & Portfolio Management',
        '2. Financial Derivatives & Interest Rate Risk',
        '3. International Financial Management',
        '4. Corporate Valuation, Mergers & Acquisitions',
        '5. Startup Finance & Securitization',
        '1. Professional Ethics & Code of Conduct',
        '2. SA 200 Series: General Principles',
        '3. SA 500 Series: Audit Evidence',
        '4. Audit of Banks & Insurance',
        '1. Assessment of Various Entities',
        '2. Transfer Pricing & International Tax',
        '3. Charitable Trusts & Tax Treaties',
        '4. Deductions & Tax Planning',
        '1. GST: Charge and Exemptions',
        '2. GST: Input Tax Credit (ITC)',
        '3. GST: Registration & Invoicing',
        '4. Customs Duty & Foreign Trade',
        // Intermediate
        '1. AS 10: Property, Plant and Equipment',
        '2. AS 19: Leases',
        '3. Company Financial Statements & Buybacks',
        '4. Branch Accounts & Reconstruction',
        '1. Management & Administration',
        '2. Declaration and Payment of Dividend',
        '3. Accounts of Companies & Audit',
        '4. General Clauses Act & Interpretation',
        '1. Income Tax: Heads of Income',
        '2. Income Tax: Deductions & TDS',
        '3. GST: Basic Concepts & Supply',
        '4. GST: Input Tax Credit (ITC)',
        '1. Material, Labor, and Overheads',
        '2. Standard & Marginal Costing',
        '3. Budgetary Control & ABC Costing',
        '4. Process, Job, and Service Costing',
        // Foundation
        '1. Theoretical Framework & Process',
        '2. Depreciation & Inventory Valuation',
        '3. Special Transactions (Consignment)',
        '4. Preparation of Final Accounts',
        '1. Indian Contract Act, 1872',
        '2. Sale of Goods Act, 1930',
        '3. Indian Partnership Act, 1932',
        '4. Limited Liability Partnership Act',
        '1. Ratio, Proportion, Indices, Logarithms',
        '2. Equations, Matrices, Inequalities',
        '3. Time Value of Money',
        '4. Permutations & Combinations',
        '1. Introduction to Economics',
        '2. Theory of Demand and Supply',
        '3. Theory of Production and Cost',
        '4. Price Determination in Markets'
      ]);

      // Identify default subjects of other levels
      const otherLevelsSubjects = new Set<string>();
      Object.entries(SYLLABUS_DATA).forEach(([levelName, levelSyllabusObj]) => {
        if (levelName !== caLevel) {
          Object.keys(levelSyllabusObj).forEach((subName) => {
            otherLevelsSubjects.add(subName);
          });
        }
      });

      // Check if progressState contains default subjects of other levels
      let hasOtherLevelSubjects = false;
      Object.keys(progressState).forEach((subName) => {
        if (otherLevelsSubjects.has(subName)) {
          hasOtherLevelSubjects = true;
        }
      });

      // Check if any default subject or default chapter is missing from progressState
      let missing = false;
      const newlyAddedSubjects: string[] = [];
      Object.entries(levelSyllabus).forEach(([subName, chapters]) => {
        if (!progressState[subName]) {
          missing = true;
          newlyAddedSubjects.push(subName);
        } else {
          chapters.forEach((chap) => {
            if (!progressState[subName][chap]) {
              missing = true;
            }
          });
        }
      });

      // Check if any subject has mock chapters in progressState
      let hasMockChapters = false;
      Object.entries(progressState).forEach(([subName, chaptersMap]) => {
        if (chaptersMap) {
          const chapNames = Object.keys(chaptersMap);
          const mockFound = chapNames.filter((c) => MOCK_CHAPTERS.has(c));
          if (mockFound.length > 0) {
            console.log(`[PRUNE] Found mock chapters in "${subName}":`, mockFound);
            hasMockChapters = true;
          }
        }
      });

      console.log('[PRUNE] caLevel:', caLevel, 'missing subjects/chapters:', missing, 'hasMockChapters:', hasMockChapters, 'hasOtherLevelSubjects:', hasOtherLevelSubjects);

      if (missing || hasMockChapters || hasOtherLevelSubjects) {
        setProgressState((prev) => {
          let updated = { ...prev };
          let changed = false;

          // Prune default subjects of other levels
          Object.keys(updated).forEach((subName) => {
            if (otherLevelsSubjects.has(subName)) {
              console.log(`[PRUNE] Removing subject of other level: "${subName}"`);
              delete updated[subName];
              changed = true;
            }
          });

          // Prune mock chapters from all subjects
          Object.keys(updated).forEach((subName) => {
            if (updated[subName]) {
              const prunedChapters: Record<string, any> = {};
              let subChanged = false;
              Object.entries(updated[subName]).forEach(([chapName, chapStatus]) => {
                if (MOCK_CHAPTERS.has(chapName)) {
                  subChanged = true;
                  changed = true;
                } else {
                  prunedChapters[chapName] = chapStatus;
                }
              });
              if (subChanged) {
                console.log(`[PRUNE] Pruning subject "${subName}". Before:`, Object.keys(updated[subName]), 'After:', Object.keys(prunedChapters));
                updated[subName] = prunedChapters;
              }
            }
          });

          // Add missing default subjects or default chapters
          Object.entries(levelSyllabus).forEach(([subName, chapters]) => {
            if (deletedDefaultSubjects.includes(subName)) {
              return; // Skip restoring deleted subjects
            }
            if (!updated[subName]) {
              updated[subName] = {};
            }
            chapters.forEach((chap) => {
              if (!updated[subName][chap]) {
                updated[subName][chap] = {
                  classDone: false,
                  priority: 'C',
                  ldrs: false,
                  revisionCycle: 0,
                };
                changed = true;
              }
            });
          });

          if (changed) {
            console.log('[PRUNE] Saving pruned/updated progressState to local storage.');
            saveToStorage(LS_KEYS.PROGRESS, updated);
          }
          return updated;
        });

        if (hasOtherLevelSubjects) {
          // Prune other levels' default subjects from subjectGroups
          setSubjectGroups((prevGroups) => {
            let updatedGroups = { ...prevGroups };
            let groupsChanged = false;
            Object.keys(updatedGroups).forEach((subName) => {
              if (otherLevelsSubjects.has(subName)) {
                delete updatedGroups[subName];
                groupsChanged = true;
              }
            });
            if (groupsChanged) {
              saveToStorage('cand_subjectGroups', updatedGroups);
            }
            return updatedGroups;
          });

          // Prune other levels' default subjects from slots
          setSlots((prevSlots) => {
            const updatedSlots = prevSlots.filter((slot) => !otherLevelsSubjects.has(slot.subject));
            if (updatedSlots.length !== prevSlots.length) {
              saveToStorage(LS_KEYS.SLOTS, updatedSlots);
            }
            return updatedSlots;
          });
          // Prune other levels' default subjects from mistakes
          setMistakes((prevMistakes) => {
            const updatedMistakes = prevMistakes.filter((m) => !otherLevelsSubjects.has(m.subjectName));
            if (updatedMistakes.length !== prevMistakes.length) {
              saveToStorage(LS_KEYS.MISTAKES, updatedMistakes);
            }
            return updatedMistakes;
          });

          // Prune other levels' default subjects from revisions
          setRevisions((prevRevisions) => {
            const updatedRevisions = prevRevisions.filter((r) => !otherLevelsSubjects.has(r.subjectName));
            if (updatedRevisions.length !== prevRevisions.length) {
              saveToStorage(LS_KEYS.REVISIONS, updatedRevisions);
            }
            return updatedRevisions;
          });
        }

        if (newlyAddedSubjects.length > 0) {
          setSubjectGroups((prevGroups) => {
            let updatedGroups = { ...prevGroups };
            let groupsChanged = false;
            const defaults: Record<string, 'Group 1' | 'Group 2'> = {
              'Paper 1: Financial Reporting': 'Group 1',
              'Paper 2: Advanced Financial Management': 'Group 1',
              'Paper 3: Advanced Auditing and Assurance': 'Group 1',
              'Paper 4: Direct Tax and International Taxation': 'Group 2',
              'Paper 5: Indirect Taxation and Customs': 'Group 2',
              'Advanced Accounting': 'Group 1',
              'Corporate & Other Laws': 'Group 1',
              'Taxation (DT & IDT)': 'Group 1',
              'Cost & Management Accounting': 'Group 2',
            };
            newlyAddedSubjects.forEach((subName) => {
              if (defaults[subName] && !updatedGroups[subName]) {
                updatedGroups[subName] = defaults[subName];
                groupsChanged = true;
              }
            });
            if (groupsChanged) {
              saveToStorage('cand_subjectGroups', updatedGroups);
            }
            return updatedGroups;
          });
        }
      }
    }
  }, [caLevel, progressState, deletedDefaultSubjects]);
  const [fullName, setFullName] = useState<string>(() => loadFromStorage(LS_KEYS.FULL_NAME, ''));
  const [examStartDate, setExamStartDate] = useState<string>(() => loadFromStorage(LS_KEYS.EXAM_START_DATE, ''));
  const [timelinePhases, setTimelinePhases] = useState<TimelinePhase[]>(() => loadFromStorage('cand_timeline_phases', []));
  const [groups, setGroups] = useState<any[]>(() => loadFromStorage('cand_study_groups_v2', []));
  useEffect(() => {
    saveToStorage('cand_study_groups_v2', groups);
  }, [groups]);
  const [preparingFor, setPreparingFor] = useState<'Group 1' | 'Group 2' | 'Both Groups'>(() => {
    try {
      const val = localStorage.getItem('cand_preparingFor');
      if (val === 'Group 1' || val === 'Group 2' || val === 'Both Groups') return val;
    } catch { /* ignore */ }
    return 'Both Groups';
  });

  // Today's study hours (resets each day)
  const [todayHours, setTodayHours] = useState<number>(() => {
    const storedKey = loadFromStorage(LS_KEYS.TODAY_DATE_KEY, '');
    const today = getLocalDateString();
    if (storedKey === today) {
      return loadFromStorage(LS_KEYS.TODAY_HOURS, 0);
    }
    return 0;
  });

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
  }, []);

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordError(null);
    if (resetPassword !== confirmResetPassword) {
      setResetPasswordError('Passwords do not match');
      return;
    }
    if (resetPassword.length < 6) {
      setResetPasswordError('Password must be at least 6 characters');
      return;
    }

    setResetPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: resetPassword });
      if (error) {
        setResetPasswordError(error.message);
      } else {
        showToast('Password updated successfully!', 'success');
        setShowResetPasswordModal(false);
        setResetPassword('');
        setConfirmResetPassword('');
      }
    } catch (err: any) {
      setResetPasswordError(err.message || 'Failed to update password');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Lifted states
  const [slots, setSlots] = useState<ScheduleSlot[]>(() => loadFromStorage(LS_KEYS.SLOTS, []));
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage(LS_KEYS.TASKS, []));
  const [revisions, setRevisions] = useState<RevisionItem[]>(() => loadFromStorage(LS_KEYS.REVISIONS, []));
  const [mistakes, setMistakes] = useState<Mistake[]>(() => loadFromStorage(LS_KEYS.MISTAKES, []));

  // Study history & planner states
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [studyHistory, setStudyHistory] = useState<Record<string, number>>(() => loadFromStorage('cand_studyHistory', {}));
  const [wakeHistory, setWakeHistory] = useState<Record<string, string>>(() => loadFromStorage('cand_wakeHistory', {}));
  const [sleepHistory, setSleepHistory] = useState<Record<string, string>>(() => loadFromStorage('cand_sleepHistory', {}));
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>(() => loadFromStorage('cand_studyLogs', []));

  // Manual Check-In history list
  const [checkInHistory, setCheckInHistory] = useState<string[]>(() => {
    const saved = loadFromStorage<string[]>('cand_checkInHistory', []);
    
    // Migration: recover old check-in state if present
    const oldCheckedInToday = loadFromStorage<boolean>(LS_KEYS.CHECKED_IN_TODAY, false);
    const oldLastCheckInDate = loadFromStorage<string>('cand_lastCheckInDate', '');
    
    let initialList = [...saved];
    if (oldCheckedInToday && oldLastCheckInDate) {
      if (!initialList.includes(oldLastCheckInDate)) {
        initialList.push(oldLastCheckInDate);
      }
    }
    return initialList;
  });

  // Dynamically derive checked-in status and streak count from all activity logs
  const checkedInToday = useMemo(() => {
    return checkInHistory.includes(getLocalDateString());
  }, [checkInHistory]);

  const streakCount = useMemo(() => {
    const dates = getActivityDates(checkInHistory, studyHistory, wakeHistory, sleepHistory);
    return calculateStreak(dates);
  }, [checkInHistory, studyHistory, wakeHistory, sleepHistory]);

  const handleSetCheckedInToday = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    const todayStr = getLocalDateString();
    setCheckInHistory((prev) => {
      const currentVal = prev.includes(todayStr);
      const newVal = typeof val === 'function' ? val(currentVal) : val;
      
      let updated: string[];
      if (newVal) {
        if (!prev.includes(todayStr)) {
          updated = [...prev, todayStr];
        } else {
          updated = prev;
        }
      } else {
        updated = prev.filter((d) => d !== todayStr);
      }
      localStorage.setItem('cand_checkInHistory', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Subject grouping (Group 1 / Group 2) mapping
  const [subjectGroups, setSubjectGroups] = useState<Record<string, 'Group 1' | 'Group 2'>>(() => {
    const raw = localStorage.getItem('cand_subjectGroups');
    const defaults: Record<string, 'Group 1' | 'Group 2'> = {
      'Paper 1: Financial Reporting': 'Group 1',
      'Paper 2: Advanced Financial Management': 'Group 1',
      'Paper 3: Advanced Auditing and Assurance': 'Group 1',
      'Paper 4: Direct Tax and International Taxation': 'Group 2',
      'Paper 5: Indirect Taxation and Customs': 'Group 2',
      'Advanced Accounting': 'Group 1',
      'Corporate & Other Laws': 'Group 1',
      'Taxation (DT & IDT)': 'Group 1',
      'Cost & Management Accounting': 'Group 2',
    };
    if (raw === null) {
      saveToStorage('cand_subjectGroups', defaults);
      return defaults;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  });

  useEffect(() => {
    saveToStorage('cand_subjectGroups', subjectGroups);
  }, [subjectGroups]);

  const handleSetSubjectGroup = useCallback((subName: string, group: 'Group 1' | 'Group 2' | null) => {
    setSubjectGroups((prev) => {
      const updated = { ...prev };
      if (group) {
        updated[subName] = group;
      } else {
        delete updated[subName];
      }
      localStorage.setItem('cand_subjectGroups', JSON.stringify(updated));
      return updated;
    });
  }, []);
  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('cand_darkMode');
      if (stored !== null) return JSON.parse(stored);
    } catch { /* ignore */ }
    return false;
  });

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('cand_darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const handleAddStudyHours = useCallback((hours: number, label?: string, dateOverride?: string) => {
    const dateStr = dateOverride || selectedDate;
    setTotalHours((prev) => parseFloat((prev + hours).toFixed(1)));
    
    const todayStr = getLocalDateString();
    if (dateStr === todayStr) {
      setTodayHours((prev) => parseFloat((prev + hours).toFixed(1)));
    }
    
    // Update study history for the date
    setStudyHistory((prev) => {
      const updated = { ...prev, [dateStr]: parseFloat(((prev[dateStr] || 0) + hours).toFixed(1)) };
      localStorage.setItem('cand_studyHistory', JSON.stringify(updated));
      return updated;
    });
    // Create a study log entry
    const newLog: StudyLog = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      date: dateStr,
      hours,
      label: label || 'Study Session',
      timestamp: new Date().toISOString(),
    };
    setStudyLogs((prev) => {
      const updated = [newLog, ...prev];
      localStorage.setItem('cand_studyLogs', JSON.stringify(updated));
      return updated;
    });
  }, [selectedDate]);

  const [isTimerFullscreen, setIsTimerFullscreen] = useState(false);
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [stickyTimerVisible, setStickyTimerVisible] = useState(false);

  // ---- Lifted Pomodoro Timer State (persists across tab switches) ----
  const [timerTimeLeft, setTimerTimeLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerType, setTimerType] = useState<'focus' | 'break'>('focus');
  const [timerPreset, setTimerPreset] = useState<'25' | '50' | '5'>('25');
  const [timerStudyLabel, setTimerStudyLabel] = useState('');
  const timerIntervalRef = useRef<number | null>(null);
  const [heartbeat, setHeartbeat] = useState(0);

  // Timer interval — lives at App level so it never unmounts
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimerTimeLeft((prev) => {
          if (prev % 120 === 0) {
            setHeartbeat((h) => h + 1);
          }
          if (prev <= 1) {
            setTimerRunning(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

            if (timerType === 'focus') {
              const hoursLogged = timerPreset === '50' ? 0.8 : 0.4;
              handleAddStudyHours(hoursLogged, timerStudyLabel ? `Pomodoro: ${timerStudyLabel}` : 'Pomodoro Focus Session', getLocalDateString());
              showLocalNotification('Focus Session Complete! 🎯', `${timerPreset} minutes logged successfully. Great job!`);
              showToast(`Focus session complete! ${timerPreset} minutes logged successfully.`, 'success');
            } else {
              showLocalNotification('Break Over! ⚡', 'Ready to start focusing? Time to get back to work.');
              showToast('Break is complete! Ready to start focusing?', 'info');
            }

            return parseInt(timerPreset, 10) * 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [timerRunning, timerType, timerPreset, showLocalNotification, handleAddStudyHours, timerStudyLabel]);

  const handleTimerSelectPreset = useCallback((preset: '25' | '50' | '5') => {
    setTimerRunning(false);
    setTimerPreset(preset);
    setTimerType(preset === '5' ? 'break' : 'focus');
    setTimerTimeLeft(parseInt(preset, 10) * 60);
  }, []);

  const handleTimerToggle = useCallback(() => {
    if (!timerRunning && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    setTimerRunning((prev) => {
      if (!prev) {
        // Starting the timer — make sticky visible
        setStickyTimerVisible(true);
      }
      return !prev;
    });
  }, []);

  const handleTimerReset = useCallback(() => {
    setTimerRunning(false);
    setTimerTimeLeft(parseInt(timerPreset, 10) * 60);
  }, [timerPreset]);

  const formatTimerDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timerStatusText = useMemo(() => {
    if (timerRunning) return timerType === 'break' ? 'BREAK' : 'FOCUSING';
    if (timerTimeLeft === parseInt(timerPreset, 10) * 60) return 'READY';
    return 'PAUSED';
  }, [timerRunning, timerType, timerTimeLeft, timerPreset]);

  // Whether to show the sticky mini-timer (explicit flag, but NOT in fullscreen)
  const showStickyTimer = !isTimerFullscreen && stickyTimerVisible;

  // Persist all state changes to localStorage
  useEffect(() => { saveToStorage(LS_KEYS.PROGRESS, progressState); }, [progressState]);
  useEffect(() => { saveToStorage(LS_KEYS.CA_LEVEL, caLevel); }, [caLevel]);
  useEffect(() => { saveToStorage(LS_KEYS.STUDY_TARGET, studyTarget); }, [studyTarget]);
  useEffect(() => { saveToStorage(LS_KEYS.TOTAL_HOURS, totalHours); }, [totalHours]);
  useEffect(() => { saveToStorage(LS_KEYS.FULL_NAME, fullName); }, [fullName]);
  useEffect(() => { saveToStorage(LS_KEYS.EXAM_START_DATE, examStartDate); }, [examStartDate]);
  useEffect(() => { saveToStorage('cand_timeline_phases', timelinePhases); }, [timelinePhases]);
  useEffect(() => { localStorage.setItem('cand_preparingFor', preparingFor); }, [preparingFor]);
  useEffect(() => {
    saveToStorage(LS_KEYS.TODAY_HOURS, todayHours);
    saveToStorage(LS_KEYS.TODAY_DATE_KEY, getLocalDateString());
  }, [todayHours]);
  useEffect(() => { saveToStorage(LS_KEYS.SLOTS, slots); }, [slots]);
  useEffect(() => { saveToStorage(LS_KEYS.TASKS, tasks); }, [tasks]);
  useEffect(() => { saveToStorage(LS_KEYS.REVISIONS, revisions); }, [revisions]);
  useEffect(() => { saveToStorage(LS_KEYS.MISTAKES, mistakes); }, [mistakes]);
  useEffect(() => { saveToStorage(LS_KEYS.STREAK_COUNT, streakCount); }, [streakCount]);
  useEffect(() => {
    saveToStorage(LS_KEYS.CHECKED_IN_TODAY, checkedInToday);
    if (checkedInToday) {
      saveToStorage('cand_lastCheckInDate', getLocalDateString());
    }
  }, [checkedInToday]);
  useEffect(() => {
    saveToStorage('cand_checkInHistory', checkInHistory);
  }, [checkInHistory]);
  useEffect(() => {
    saveToStorage('cand_tests', tests);
  }, [tests]);
  useEffect(() => {
    saveToStorage('cand_favourite_questions', favouriteQuestions);
  }, [favouriteQuestions]);



  // ---- Supabase cloud backup sync ----
  const syncTimerRef = useRef<number | null>(null);
  const hasSyncedRef = useRef(false); // prevent double-load on mount

  // Ref to always hold the latest state values for loadCloudData callbacks without stale closure issues
  const stateRef = useRef({ progressState, caLevel, studyTarget, totalHours, slots, tasks, revisions, mistakes, fullName, examStartDate, streakCount, checkedInToday, studyHistory, wakeHistory, sleepHistory, studyLogs, todayHours, checkInHistory, subjectGroups, preparingFor, tests, favouriteQuestions, timelinePhases, groups });
  useEffect(() => {
    stateRef.current = { progressState, caLevel, studyTarget, totalHours, slots, tasks, revisions, mistakes, fullName, examStartDate, streakCount, checkedInToday, studyHistory, wakeHistory, sleepHistory, studyLogs, todayHours, checkInHistory, subjectGroups, preparingFor, tests, favouriteQuestions, timelinePhases, groups };
  }, [progressState, caLevel, studyTarget, totalHours, slots, tasks, revisions, mistakes, fullName, examStartDate, streakCount, checkedInToday, studyHistory, wakeHistory, sleepHistory, studyLogs, todayHours, checkInHistory, subjectGroups, preparingFor, tests, favouriteQuestions, timelinePhases, groups]);

  // Load cloud data on login (restores progress on new device)
  const loadCloudData = useCallback(async (userId: string, email: string) => {
    if (hasSyncedRef.current) return;

    try {
      const cloud = await loadFromSupabase(userId);
      hasSyncedRef.current = true; // only mark synced if load completed successfully (found or not found)
      if (cloud) {
        // Check if account is active
        if (cloud.is_active === false) {
          showToast('Your account has been deactivated by an administrator.', 'error');
          await supabase.auth.signOut();
          
          // Clear local state
          const keys = [
            'cand_progress', 'cand_caLevel', 'cand_studyTarget', 'cand_totalHours',
            'cand_fullName', 'cand_examStartDate', 'cand_todayHours', 'cand_todayDateKey',
            'cand_schedule_slots', 'cand_planner_tasks', 'cand_revisions', 'cand_mistakes',
            'cand_streakCount', 'cand_checkedInToday', 'cand_checkInHistory', 'cand_studyHistory',
            'cand_wakeHistory', 'cand_sleepHistory', 'cand_studyLogs', 'cand_lastCheckInDate',
            'cand_subjectGroups', 'cand_preparingFor', 'cand_tests', 'cand_timeline_phases',
            'cand_study_groups_v2'
          ];
          keys.forEach(k => localStorage.removeItem(k));
          
          setSession(null);
          setActiveTab('home');
          hasSyncedRef.current = false;
          return;
        }

        // Cloud data exists → restore it (overrides local)
        const cloudState = cloud.progress_state;
        if (cloudState && typeof cloudState === 'object' && 'checklist' in cloudState) {
          // Unpack new format
          const packed = cloudState as unknown as {
            checklist?: ProgressState;
            tasks?: Task[];
            revisions?: RevisionItem[];
            mistakes?: Mistake[];
            slots?: ScheduleSlot[];
            fullName?: string;
            examStartDate?: string;
            streakCount?: number;
            checkedInToday?: boolean;
            studyHistory?: Record<string, number>;
            wakeHistory?: Record<string, string>;
            sleepHistory?: Record<string, string>;
            studyLogs?: StudyLog[];
            todayHours?: number;
            checkInHistory?: string[];
            subjectGroups?: Record<string, 'Group 1' | 'Group 2'>;
            preparingFor?: 'Group 1' | 'Group 2' | 'Both Groups';
            tests?: TestRecord[];
            favouriteQuestions?: any[];
            streakMigrated?: boolean;
            timelinePhases?: TimelinePhase[];
            deletedDefaultSubjects?: string[];
            groups?: any[];
          };
          setProgressState(packed.checklist || {});
          setTasks(packed.tasks || []);
          setRevisions(packed.revisions || []);
          setMistakes(packed.mistakes || []);
          setSlots(packed.slots || []);
          setTests(packed.tests || []);
          setFavouriteQuestions(packed.favouriteQuestions || []);
          if (packed.deletedDefaultSubjects) {
            setDeletedDefaultSubjects(packed.deletedDefaultSubjects);
            localStorage.setItem('cand_deletedDefaultSubjects', JSON.stringify(packed.deletedDefaultSubjects));
          } else {
            setDeletedDefaultSubjects([]);
            localStorage.removeItem('cand_deletedDefaultSubjects');
          }
          if (packed.fullName) setFullName(packed.fullName);
          if (packed.examStartDate) setExamStartDate(packed.examStartDate);
          if (packed.timelinePhases) setTimelinePhases(packed.timelinePhases);
          // Load checkInHistory from cloud if present
          if (packed.checkInHistory) {
            setCheckInHistory(packed.checkInHistory);
            localStorage.setItem('cand_checkInHistory', JSON.stringify(packed.checkInHistory));
          } else if (packed.streakMigrated && packed.checkedInToday && packed.streakCount) {
            // Fallback for older backups: reconstruct checking history from current status
            const todayStr = getLocalDateString();
            setCheckInHistory([todayStr]);
            localStorage.setItem('cand_checkInHistory', JSON.stringify([todayStr]));
          }
          if (packed.subjectGroups) {
            setSubjectGroups(packed.subjectGroups);
            localStorage.setItem('cand_subjectGroups', JSON.stringify(packed.subjectGroups));
          }
          if (packed.preparingFor) {
            setPreparingFor(packed.preparingFor);
            localStorage.setItem('cand_preparingFor', packed.preparingFor);
          }
          if (packed.studyHistory) {
            setStudyHistory(packed.studyHistory);
            localStorage.setItem('cand_studyHistory', JSON.stringify(packed.studyHistory));
          }
          if (packed.wakeHistory) {
            setWakeHistory(packed.wakeHistory);
            localStorage.setItem('cand_wakeHistory', JSON.stringify(packed.wakeHistory));
          }
          if (packed.sleepHistory) {
            setSleepHistory(packed.sleepHistory);
            localStorage.setItem('cand_sleepHistory', JSON.stringify(packed.sleepHistory));
          }
          if (packed.studyLogs) {
            setStudyLogs(packed.studyLogs);
            localStorage.setItem('cand_studyLogs', JSON.stringify(packed.studyLogs));
          }
          if (packed.todayHours !== undefined) {
            setTodayHours(packed.todayHours);
            localStorage.setItem('cand_todayHours', JSON.stringify(packed.todayHours));
          }
          if (packed.groups) {
            setGroups(packed.groups);
            localStorage.setItem('cand_study_groups_v2', JSON.stringify(packed.groups));
          }
        } else {
          // Old format (just progressState)
          setProgressState(cloudState || {});
        }
        setCaLevel(cloud.ca_level);
        setStudyTarget(cloud.study_target);
        setTotalHours(cloud.total_hours);
        
        // Backfill email and name if missing in database
        if (!cloud.email || !cloud.full_name) {
          let resolvedName = '';
          if (cloudState && typeof cloudState === 'object' && 'fullName' in cloudState) {
            resolvedName = (cloudState as any).fullName || '';
          }
          if (!resolvedName) resolvedName = stateRef.current.fullName || '';

          saveToSupabase(userId, {
            progress_state: cloudState,
            ca_level: cloud.ca_level,
            study_target: cloud.study_target,
            total_hours: cloud.total_hours,
            email: email,
            full_name: resolvedName
          });
        }
        console.log('Progress restored from cloud backup.');
      } else {
        // No cloud data yet (new user ID) → reset study progress/history to prevent inheriting mock data
        const cl = stateRef.current.caLevel || 'Intermediate';
        const st = stateRef.current.studyTarget || 6;
        const fn = stateRef.current.fullName || '';

        const cleanProgress = buildInitialProgress();
        setProgressState(cleanProgress);
        setTotalHours(0);
        setTodayHours(0);
        setSlots([]);
        setTasks([]);
        setRevisions([]);
        setMistakes([]);
        setCheckInHistory([]);
        setStudyHistory({});
        setWakeHistory({});
        setSleepHistory({});
        setStudyLogs([]);
        setSubjectGroups({});
        setPreparingFor('Both Groups');
        setDeletedDefaultSubjects([]);
        setGroups([]);

        localStorage.removeItem(LS_KEYS.PROGRESS);
        localStorage.removeItem(LS_KEYS.TOTAL_HOURS);
        localStorage.removeItem(LS_KEYS.TODAY_HOURS);
        localStorage.removeItem(LS_KEYS.SLOTS);
        localStorage.removeItem(LS_KEYS.TASKS);
        localStorage.removeItem(LS_KEYS.REVISIONS);
        localStorage.removeItem(LS_KEYS.MISTAKES);
        localStorage.removeItem('cand_checkInHistory');
        localStorage.removeItem('cand_studyHistory');
        localStorage.removeItem('cand_wakeHistory');
        localStorage.removeItem('cand_sleepHistory');
        localStorage.removeItem('cand_studyLogs');
        localStorage.removeItem('cand_lastCheckInDate');
        localStorage.removeItem('cand_subjectGroups');
        localStorage.removeItem('cand_preparingFor');
        localStorage.removeItem('cand_tests');
        localStorage.removeItem('cand_deletedDefaultSubjects');
        localStorage.removeItem('cand_study_groups_v2');

        // Pack clean state for Supabase
        const packedProgress = {
          checklist: cleanProgress,
          tasks: [],
          revisions: [],
          mistakes: [],
          slots: [],
          fullName: fn,
          examStartDate: '',
          streakCount: 0,
          checkedInToday: false,
          studyHistory: {},
          wakeHistory: {},
          sleepHistory: {},
          studyLogs: [],
          todayHours: 0,
          checkInHistory: [],
          subjectGroups: {},
          preparingFor: 'Both Groups',
          tests: [],
          streakMigrated: true,
          deletedDefaultSubjects: [],
          groups: []
        };

        await saveToSupabase(userId, {
          progress_state: packedProgress as unknown as ProgressState,
          ca_level: cl,
          study_target: st,
          total_hours: 0,
          email: email,
          full_name: fn || '',
        });
        console.log('Clean initial cloud backup created.');
      }
    } catch (err) {
      console.warn('Could not sync with Supabase cloud backup:', err);
    }
  }, []);

  // Debounced save to Supabase on every state change (2s delay)
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      // Pack the state
      const packedProgress = {
        checklist: progressState,
        tasks,
        revisions,
        mistakes,
        slots,
        fullName,
        examStartDate,
        streakCount,
        checkedInToday,
        studyHistory,
        wakeHistory,
        sleepHistory,
        studyLogs,
        todayHours,
        checkInHistory,
        subjectGroups,
        preparingFor,
        tests,
        favouriteQuestions,
        streakMigrated: true,
        timelinePhases,
        deletedDefaultSubjects,
        groups,
        timerRunning
      };

      saveToSupabase(userId, {
        progress_state: packedProgress as unknown as ProgressState,
        ca_level: caLevel,
        study_target: studyTarget,
        total_hours: totalHours,
        email: session.user.email || '',
        full_name: fullName || '',
      });
    }, 2000); // debounce 2 seconds

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [progressState, caLevel, studyTarget, totalHours, fullName, examStartDate, tasks, revisions, mistakes, slots, streakCount, checkedInToday, studyHistory, wakeHistory, sleepHistory, studyLogs, todayHours, checkInHistory, subjectGroups, preparingFor, tests, favouriteQuestions, session, timelinePhases, deletedDefaultSubjects, groups, timerRunning, heartbeat]);

  // Listen for service worker update events from main.tsx
  useEffect(() => {
    const handleUpdateAvailable = (e: Event) => {
      const worker = (e as CustomEvent).detail as ServiceWorker;
      setSwUpdateWorker(worker);
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);
    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);



  const loadUserMetadata = (currentSession: Session | null) => {
    if (currentSession?.user?.user_metadata) {
      const meta = currentSession.user.user_metadata;
      if (meta.ca_level) setCaLevel(meta.ca_level);
      if (meta.study_hours_target) setStudyTarget(meta.study_hours_target);
      if (meta.full_name) setFullName(meta.full_name);
    }
  };

  // Listen to Supabase authorization status
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    
    try {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
        loadUserMetadata(s);
        if (s?.user?.id) loadCloudData(s.user.id, s.user.email || '');
      }).catch((err) => {
        console.warn('Supabase getSession failed (credentials may be invalid):', err);
      });

      const { data } = supabase.auth.onAuthStateChange((event, s) => {
        setSession(s);
        loadUserMetadata(s);
        if (s?.user?.id) loadCloudData(s.user.id, s.user.email || '');
        if (event === 'PASSWORD_RECOVERY') {
          setShowResetPasswordModal(true);
        }
      });
      subscription = data.subscription;
    } catch (err) {
      console.warn('Supabase auth setup failed:', err);
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [loadCloudData]);

  // Background scheduler for study slot starting times
  useEffect(() => {
    let lastNotifiedKey = '';

    const checkScheduleSlots = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      try {
        const rawSlots = localStorage.getItem('cand_schedule_slots');
        if (!rawSlots) return;
        interface LocalScheduleSlot {
          id: string;
          subject: string;
          chapter?: string;
          phase?: string;
          day?: string;
          timeStart?: string;
          timeEnd?: string;
          isCustomRange?: boolean;
          dateFrom?: string;
          dateTo?: string;
        }
        const slots = JSON.parse(rawSlots) as LocalScheduleSlot[];

        const now = new Date();
        const currentHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        // Key to prevent duplicate fires within the same minute
        const currentMinuteKey = `${now.toDateString()}_${currentHHMM}`;
        if (currentMinuteKey === lastNotifiedKey) return;

        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayDayName = days[now.getDay()];
        const todayDateStr = now.toISOString().split('T')[0];

        // Find if any slot is starting now
        const activeSlot = slots.find((s) => {
          if (s.timeStart !== currentHHMM) return false;

          // Check date/day constraints
          if (s.isCustomRange) {
            if (s.dateFrom && todayDateStr < s.dateFrom) return false;
            if (s.dateTo && todayDateStr > s.dateTo) return false;
          } else {
            if (s.day && s.day.toLowerCase() !== todayDayName) return false;
          }
          return true;
        });

        if (activeSlot) {
          lastNotifiedKey = currentMinuteKey;

          const title = 'Study Session Starting! 📚';
          const body = `${activeSlot.subject}${activeSlot.chapter ? ` - ${activeSlot.chapter}` : ''} starts now.`;

          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready
              .then((registration) => {
                registration.showNotification(title, {
                  body: body,
                  icon: '/logo.png',
                  badge: '/logo.png',
                  vibrate: [200, 100, 200],
                } as NotificationOptions & { vibrate?: number[]; badge?: string });
              })
              .catch(() => {
                new Notification(title, { body });
              });
          } else {
            new Notification(title, { body });
          }
        }
      } catch (err) {
        console.warn('Error checking schedule slots for notification:', err);
      }
    };

    // Check immediately and then every 30 seconds
    checkScheduleSlots();
    const interval = setInterval(checkScheduleSlots, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdateCaLevel = async (level: string) => {
    setCaLevel(level);
    if (session?.user) {
      const { error } = await supabase.auth.updateUser({
        data: { ca_level: level }
      });
      if (error) console.error('Error updating CA level metadata:', error.message);
    }
  };

  const handleUpdateStudyTarget = async (target: number) => {
    setStudyTarget(target);
    if (session?.user) {
      const { error } = await supabase.auth.updateUser({
        data: { study_hours_target: target }
      });
      if (error) console.error('Error updating target hours metadata:', error.message);
    }
  };

  const handleUpdateFullName = async (name: string) => {
    setFullName(name);
    if (session?.user) {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name }
      });
      if (error) console.error('Error updating full name metadata:', error.message);
    }
  };

  const handleUpdatePreparingFor = (val: 'Group 1' | 'Group 2' | 'Both Groups') => {
    setPreparingFor(val);
    saveToStorage('cand_preparingFor', val);
  };



  const handleUpdateWakeTime = (time: string) => {
    setWakeHistory((prev) => {
      const updated = { ...prev, [selectedDate]: time };
      localStorage.setItem('cand_wakeHistory', JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdateSleepTime = (time: string) => {
    setSleepHistory((prev) => {
      const updated = { ...prev, [selectedDate]: time };
      localStorage.setItem('cand_sleepHistory', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteStudyLog = useCallback((logId: string) => {
    setStudyLogs((prev) => {
      const log = prev.find((l) => l.id === logId);
      if (log) {
        // Subtract hours from history and totals
        setStudyHistory((h) => {
          const updated = { ...h, [log.date]: parseFloat(((h[log.date] || 0) - log.hours).toFixed(1)) };
          if (updated[log.date] <= 0) delete updated[log.date];
          localStorage.setItem('cand_studyHistory', JSON.stringify(updated));
          return updated;
        });
        const today = new Date().toISOString().split('T')[0];
        if (log.date === today) {
          setTodayHours((prev) => Math.max(0, parseFloat((prev - log.hours).toFixed(1))));
        }
        setTotalHours((prev) => Math.max(0, parseFloat((prev - log.hours).toFixed(1))));
      }
      const updated = prev.filter((l) => l.id !== logId);
      localStorage.setItem('cand_studyLogs', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleResetDailyTotal = useCallback((date: string) => {
    setStudyLogs((prev) => {
      const logsForDate = prev.filter((l) => l.date === date);
      const totalForDate = logsForDate.reduce((sum, l) => sum + l.hours, 0);
      setStudyHistory((h) => {
        const updated = { ...h };
        delete updated[date];
        localStorage.setItem('cand_studyHistory', JSON.stringify(updated));
        return updated;
      });
      const today = new Date().toISOString().split('T')[0];
      if (date === today) {
        setTodayHours(0);
      }
      setTotalHours((prev) => Math.max(0, parseFloat((prev - totalForDate).toFixed(1))));
      const updated = prev.filter((l) => l.date !== date);
      localStorage.setItem('cand_studyLogs', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleToggleClass = (subName: string, chapName: string) => {
    setProgressState((prev) => {
      const subject = prev[subName] || {};
      const chapter = subject[chapName] || {
        classDone: false,
        priority: 'C',
        ldrs: false,
        revisionCycle: 0,
      };
      return {
        ...prev,
        [subName]: {
          ...subject,
          [chapName]: {
            ...chapter,
            classDone: !chapter.classDone,
          },
        },
      };
    });
  };

  const handleSetPriority = (subName: string, chapName: string, priority: 'A' | 'B' | 'C') => {
    setProgressState((prev) => {
      const subject = prev[subName] || {};
      const chapter = subject[chapName] || {
        classDone: false,
        priority: 'C',
        ldrs: false,
        revisionCycle: 0,
      };
      return {
        ...prev,
        [subName]: {
          ...subject,
          [chapName]: {
            ...chapter,
            priority,
          },
        },
      };
    });
  };

  const handleToggleLdrs = (subName: string, chapName: string) => {
    setProgressState((prev) => {
      const subject = prev[subName] || {};
      const chapter = subject[chapName] || {
        classDone: false,
        priority: 'C',
        ldrs: false,
        revisionCycle: 0,
      };
      return {
        ...prev,
        [subName]: {
          ...subject,
          [chapName]: {
            ...chapter,
            ldrs: !chapter.ldrs,
          },
        },
      };
    });
  };

  const handleToggleRevisionCycle = (subName: string, chapName: string, cycle: number) => {
    setProgressState((prev) => {
      const subject = prev[subName] || {};
      const chapter = subject[chapName] || {
        classDone: false,
        priority: 'C',
        ldrs: false,
        revisionCycle: 0,
      };
      
      let newCycle = cycle;
      if (chapter.revisionCycle === cycle) {
        newCycle = cycle - 1; // untoggle back
      }
      
      return {
        ...prev,
        [subName]: {
          ...subject,
          [chapName]: {
            ...chapter,
            revisionCycle: newCycle,
          },
        },
      };
    });
  };

  const handleAddChapter = (subName: string, chapName: string, priority: 'A' | 'B' | 'C') => {
    setProgressState((prev) => {
      const subject = prev[subName] || {};
      return {
        ...prev,
        [subName]: {
          ...subject,
          [chapName]: {
            classDone: false,
            priority,
            ldrs: false,
            revisionCycle: 0,
            isCustom: true,
          },
        },
      };
    });
  };

  const handleDeleteChapter = (subName: string, chapName: string) => {
    setProgressState((prev) => {
      const subject = { ...prev[subName] };
      delete subject[chapName];
      return {
        ...prev,
        [subName]: subject,
      };
    });
    setRevisions((prev) => prev.filter((r) => !(r.subjectName === subName && r.chapterName === chapName)));
    setMistakes((prev) => prev.filter((m) => !(m.subjectName === subName && m.chapterName === chapName)));
  };

  const handleAddSubject = (subName: string, group: 'Group 1' | 'Group 2' | null) => {
    setDeletedDefaultSubjects((prev) => {
      const next = prev.filter((name) => name !== subName);
      saveToStorage('cand_deletedDefaultSubjects', next);
      return next;
    });

    setProgressState((prev) => {
      if (prev[subName]) return prev;
      return {
        ...prev,
        [subName]: {},
      };
    });
    setSubjectGroups((prev) => {
      const updated = { ...prev };
      if (group) {
        updated[subName] = group;
      } else {
        delete updated[subName];
      }
      localStorage.setItem('cand_subjectGroups', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteSubject = (subName: string) => {
    const levelSyllabus = SYLLABUS_DATA[caLevel as keyof typeof SYLLABUS_DATA];
    if (levelSyllabus && levelSyllabus[subName as keyof typeof levelSyllabus] !== undefined) {
      setDeletedDefaultSubjects((prev) => {
        const next = [...prev];
        if (!next.includes(subName)) {
          next.push(subName);
        }
        saveToStorage('cand_deletedDefaultSubjects', next);
        return next;
      });
    }

    setProgressState((prev) => {
      const newState = { ...prev };
      delete newState[subName];
      return newState;
    });
    setSubjectGroups((prev) => {
      const updated = { ...prev };
      delete updated[subName];
      localStorage.setItem('cand_subjectGroups', JSON.stringify(updated));
      return updated;
    });
    setRevisions((prev) => prev.filter((r) => r.subjectName !== subName));
    setMistakes((prev) => prev.filter((m) => m.subjectName !== subName));
  };

  const handleSetVideoUrl = (subName: string, chapName: string, url: string) => {
    setProgressState((prev) => {
      const subject = prev[subName] || {};
      const chapter = subject[chapName] || {
        classDone: false,
        priority: 'C',
        ldrs: false,
        revisionCycle: 0,
      };
      return {
        ...prev,
        [subName]: {
          ...subject,
          [chapName]: {
            ...chapter,
            videoUrl: url || undefined,
          },
        },
      };
    });
  };

  const handleSetLdrNotes = (subName: string, chapName: string, notes: string, ldrs: boolean) => {
    setProgressState((prev) => {
      const subject = prev[subName] || {};
      const chapter = subject[chapName] || {
        classDone: false,
        priority: 'C',
        ldrs: false,
        revisionCycle: 0,
      };
      return {
        ...prev,
        [subName]: {
          ...subject,
          [chapName]: {
            ...chapter,
            ldrNotes: notes,
            ldrs: ldrs,
          },
        },
      };
    });
  };

  const resetLocalState = () => {
    setCaLevel('Intermediate');
    setStudyTarget(6);
    setTotalHours(0);
    setProgressState(buildInitialProgress());
    setFullName('');
    setExamStartDate('');
    setTodayHours(0);
    setSlots([]);
    setTasks([]);
    setRevisions([]);
    setMistakes([]);
    setCheckInHistory([]);
    setStudyHistory({});
    setWakeHistory({});
    setSleepHistory({});
    setStudyLogs([]);
    setSubjectGroups({});
    setPreparingFor('Both Groups');
    setTests([]);
    setTimelinePhases([]);
    setDeletedDefaultSubjects([]);
    setGroups([]);

    localStorage.removeItem(LS_KEYS.CA_LEVEL);
    localStorage.removeItem(LS_KEYS.STUDY_TARGET);
    localStorage.removeItem(LS_KEYS.TOTAL_HOURS);
    localStorage.removeItem(LS_KEYS.PROGRESS);
    localStorage.removeItem(LS_KEYS.FULL_NAME);
    localStorage.removeItem(LS_KEYS.EXAM_START_DATE);
    localStorage.removeItem(LS_KEYS.TODAY_HOURS);
    localStorage.removeItem(LS_KEYS.TODAY_DATE_KEY);
    localStorage.removeItem(LS_KEYS.SLOTS);
    localStorage.removeItem(LS_KEYS.TASKS);
    localStorage.removeItem(LS_KEYS.REVISIONS);
    localStorage.removeItem(LS_KEYS.MISTAKES);
    localStorage.removeItem(LS_KEYS.STREAK_COUNT);
    localStorage.removeItem(LS_KEYS.CHECKED_IN_TODAY);
    localStorage.removeItem('cand_checkInHistory');
    localStorage.removeItem('cand_studyHistory');
    localStorage.removeItem('cand_wakeHistory');
    localStorage.removeItem('cand_sleepHistory');
    localStorage.removeItem('cand_studyLogs');
    localStorage.removeItem('cand_lastCheckInDate');
    localStorage.removeItem('cand_subjectGroups');
    localStorage.removeItem('cand_preparingFor');
    localStorage.removeItem('cand_tests');
    localStorage.removeItem('cand_timeline_phases');
    localStorage.removeItem('cand_deletedDefaultSubjects');
    localStorage.removeItem('cand_study_groups_v2');
  };

  const handleLogout = () => {
    resetLocalState();
    setSession(null);
    setActiveTab('home');
    hasSyncedRef.current = false;
  };

  return (
    <div className="app-shell-wrapper">
      {/* Screen Content wrapper */}
      <div className="screen-content">
        {!session ? (
          <Auth onAuthSuccess={() => setActiveTab('home')} />
        ) : (
          <>
            {activeTab === 'home' && (
              <Dashboard
                showToast={showToast}
                userEmail={session.user.email || 'CA Student'}
                userFullName={fullName}
                caLevel={caLevel}
                studyTarget={studyTarget}
                totalHours={totalHours}
                todayHours={todayHours}
                examStartDate={examStartDate}
                onStartSession={() => setActiveTab('planner')}
                progressState={progressState}
                slots={slots}
                setSlots={setSlots}
                streakCount={streakCount}
                checkedInToday={checkedInToday}
                setCheckedInToday={handleSetCheckedInToday}
                darkMode={darkMode}
                onToggleDarkMode={() => setDarkMode(prev => !prev)}
                preparingFor={preparingFor}
                subjectGroups={subjectGroups}
                onOpenTools={() => setActiveTab('tools')}
              />
            )}
            {activeTab === 'tools' && (
              <Tools
                onBack={() => setActiveTab('home')}
                onOpenTool={(toolId) => setActiveTab(toolId)}
              />
            )}
            {activeTab === 'links-manager' && (
              <LinksManager
                onBack={() => setActiveTab('tools')}
              />
            )}
            {activeTab === 'time-manager' && (
              <TimeManager
                caLevel={caLevel}
                progressState={progressState}
                studyLogs={studyLogs}
                onBack={() => setActiveTab('tools')}
              />
            )}
            {activeTab === 'study-buddy' && (
              <StudyBuddy
                userId={session?.user?.id || 'guest'}
                userFullName={fullName}
                userEmail={session?.user?.email || ''}
                progressState={progressState}
                subjectGroups={subjectGroups}
                onBack={() => setActiveTab('tools')}
                isAdmin={isAdmin}
                todayHours={todayHours}
                groups={groups}
                setGroups={setGroups}
                preparingFor={preparingFor}
                timerRunning={timerRunning}
              />
            )}
            {activeTab === 'timeline' && (
              <Timeline
                examStartDate={examStartDate}
                onUpdateExamStartDate={setExamStartDate}
                timelinePhases={timelinePhases}
                onUpdateTimelinePhases={setTimelinePhases}
                onBack={() => setActiveTab('tools')}
              />
            )}
            {activeTab === 'subjects' && (
              <Subjects
                showToast={showToast}
                caLevel={caLevel}
                progressState={progressState}
                subjectGroups={subjectGroups}
                onSetSubjectGroup={handleSetSubjectGroup}
                onToggleClass={handleToggleClass}
                onSetPriority={handleSetPriority}
                onToggleLdrs={handleToggleLdrs}
                onToggleRevisionCycle={handleToggleRevisionCycle}
                onAddChapter={handleAddChapter}
                onDeleteChapter={handleDeleteChapter}
                onAddSubject={handleAddSubject}
                onDeleteSubject={handleDeleteSubject}
                onSetVideoUrl={handleSetVideoUrl}
                onSetLdrNotes={handleSetLdrNotes}
                onOpenTestPage={() => setActiveTab('test')}
              />
            )}
            {activeTab === 'test' && (
              <Test
                showToast={showToast}
                caLevel={caLevel}
                onChangeCaLevel={handleUpdateCaLevel}
                progressState={progressState}
                tests={tests}
                setTests={setTests}
                onBack={() => setActiveTab('subjects')}
                dynamicPapers={dynamicPapers}
                favouriteQuestions={favouriteQuestions}
                setFavouriteQuestions={setFavouriteQuestions}
              />
            )}
            {activeTab === 'planner' && (
              <Planner
                showToast={showToast}
                onAddStudyHours={handleAddStudyHours}
                caLevel={caLevel}
                tasks={tasks}
                setTasks={setTasks}
                todayHours={todayHours}
                timerTimeLeft={timerTimeLeft}
                timerRunning={timerRunning}
                timerType={timerType}
                timerPreset={timerPreset}
                timerStatusText={timerStatusText}
                onTimerSelectPreset={handleTimerSelectPreset}
                onTimerToggle={handleTimerToggle}
                onTimerReset={handleTimerReset}
                formatTimerDisplay={formatTimerDisplay}
                timerStudyLabel={timerStudyLabel}
                setTimerStudyLabel={setTimerStudyLabel}
                progressState={progressState}
                studyTarget={studyTarget}
                setStudyTarget={handleUpdateStudyTarget}
                studyHistory={studyHistory}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                wakeTime={wakeHistory[selectedDate] ?? ''}
                setWakeTime={handleUpdateWakeTime}
                sleepTime={sleepHistory[selectedDate] ?? ''}
                setSleepTime={handleUpdateSleepTime}
                sleepHistory={sleepHistory}
                isTimerFullscreen={isTimerFullscreen}
                setIsTimerFullscreen={setIsTimerFullscreen}
                isChartFullscreen={isChartFullscreen}
                setIsChartFullscreen={setIsChartFullscreen}
                studyLogs={studyLogs}
                onDeleteStudyLog={handleDeleteStudyLog}
                onResetDailyTotal={handleResetDailyTotal}
              />
            )}
            {activeTab === 'analytics' && (
              <Analytics 
                showToast={showToast}
                caLevel={caLevel}
                totalHours={totalHours} 
                progressState={progressState}
                onToggleRevisionCycle={handleToggleRevisionCycle}
                revisions={revisions}
                setRevisions={setRevisions}
                mistakes={mistakes}
                setMistakes={setMistakes}
              />
            )}
            {activeTab === 'profile' && (
              <Profile
                showToast={showToast}
                userEmail={session.user.email || 'CA Student'}
                caLevel={caLevel}
                setCaLevel={handleUpdateCaLevel}
                studyTarget={studyTarget}
                setStudyTarget={handleUpdateStudyTarget}
                onLogout={handleLogout}
                fullName={fullName}
                onUpdateFullName={handleUpdateFullName}
                examStartDate={examStartDate}
                onUpdateExamStartDate={setExamStartDate}
                preparingFor={preparingFor}
                onUpdatePreparingFor={handleUpdatePreparingFor}
              />
            )}
            {activeTab === 'admin' && isAdmin && (
              <AdminPanel
                showToast={showToast}
                dynamicPapers={dynamicPapers}
                onRefresh={fetchDynamicPapers}
                globalSubjects={globalSubjects}
                onRefreshGlobalSubjects={fetchGlobalSubjects}
              />
            )}
          </>
        )}
      </div>

      {/* Sticky floating mini-timer — visible on all screens when timer is active */}
      {session && showStickyTimer && (
        <div className={`sticky-mini-timer ${timerRunning ? 'running' : 'paused'} ${timerType === 'break' ? 'break-mode' : ''}`}>
          <div className="mini-timer-content-group">
            <div className="mini-timer-left">
              <div className="mini-timer-icon-only">
                <Timer size={22} />
              </div>
            </div>

            <div className="mini-timer-center">
              <span className="mini-timer-time">{formatTimerDisplay(timerTimeLeft)}</span>
              <span className="mini-timer-subtitle">
                {timerPreset} MIN {timerType === 'break' ? 'BREAK' : 'FOCUS'}
              </span>
            </div>
          </div>

          <div className="mini-timer-controls">
            <button 
              type="button" 
              className="mini-timer-btn control-btn" 
              onClick={handleTimerToggle}
              title={timerRunning ? 'Pause' : 'Start'}
            >
              {timerRunning ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
            </button>
            <button 
              type="button" 
              className="mini-timer-btn reset-btn" 
              onClick={handleTimerReset}
              title="Reset"
            >
              <RotateCcw size={16} />
            </button>
            <button 
              type="button" 
              className="mini-timer-btn close-btn" 
              onClick={() => { setTimerRunning(false); setTimerTimeLeft(parseInt(timerPreset, 10) * 60); setStickyTimerVisible(false); }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* bottom navigation bar visible only when authorized and not in fullscreen mode */}
      {session && !isTimerFullscreen && !isChartFullscreen && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} />
      )}

      {/* Sleek App Toast Notifications Portal */}
      {toast && createPortal(
        <div className={`app-toast-container ${toast.type}`}>
          <div className="app-toast-content">
            {toast.type === 'success' && <CheckCircle size={16} className="toast-icon success" />}
            {toast.type === 'error' && <AlertCircle size={16} className="toast-icon error" />}
            {toast.type === 'warning' && <AlertTriangle size={16} className="toast-icon warning" />}
            {toast.type === 'info' && <Info size={16} className="toast-icon info" />}
            <span>{toast.message}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Password Reset Modal Portal */}
      {showResetPasswordModal && createPortal(
        <div className="matrix-modal-overlay">
          <div className="matrix-modal-card" style={{ maxWidth: '380px' }}>
            <div className="matrix-modal-header" style={{ marginBottom: '12px' }}>
              <div>
                <h2 className="matrix-modal-title">Reset Your Password</h2>
                <p className="matrix-modal-subtitle">Set a secure new password for your account</p>
              </div>
              <button 
                type="button" 
                className="matrix-modal-close-btn"
                onClick={() => setShowResetPasswordModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="auth-form" style={{ gap: '12px', marginTop: '8px' }}>
              {resetPasswordError && (
                <div className="auth-alert error" style={{ margin: '0 0 12px 0', padding: '10px', borderRadius: '8px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '12px' }}>{resetPasswordError}</span>
                </div>
              )}

              <div className="input-group">
                <label htmlFor="modalNewPassword">New Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    id="modalNewPassword"
                    type={showResetPasswordVal ? 'text' : 'password'}
                    placeholder="Enter new password (min. 6 chars)"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 36px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      fontSize: '13px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowResetPasswordVal(!showResetPasswordVal)}
                    tabIndex={-1}
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
                    {showResetPasswordVal ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="modalConfirmPassword">Confirm Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    id="modalConfirmPassword"
                    type={showResetPasswordVal ? 'text' : 'password'}
                    placeholder="Confirm your new password"
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 36px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      fontSize: '13px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div className="matrix-modal-actions" style={{ marginTop: '16px', gap: '8px' }}>
                <button
                  type="button"
                  className="matrix-modal-cancel-btn"
                  onClick={() => setShowResetPasswordModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="matrix-modal-save-btn"
                  disabled={resetPasswordLoading}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {resetPasswordLoading ? <span className="spinner" style={{ width: '16px', height: '16px' }}></span> : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Service Worker Update Banner */}
      {swUpdateWorker && createPortal(
        <div className="update-banner">
          <div className="update-banner-content">
            <Info className="update-banner-icon" size={18} />
            <div className="update-banner-text">
              <span className="update-title">Update Available! ✨</span>
              <span className="update-subtitle">A new version of CA Next Door is ready.</span>
            </div>
            <button 
              type="button" 
              className="update-action-btn"
              onClick={() => {
                swUpdateWorker.postMessage({ type: 'SKIP_WAITING' });
              }}
            >
              Update Now
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default App;
