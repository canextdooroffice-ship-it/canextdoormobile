import { useState, useEffect, useRef, useCallback } from 'react';
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
import { SYLLABUS_DATA } from './constants/syllabus';
import type { ProgressState } from './components/Subjects';
import type { ScheduleSlot } from './components/Dashboard';
import type { Task } from './components/Planner';
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
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<string>('home');
  
  // CA Student settings — loaded from localStorage first, then Supabase metadata
  const [caLevel, setCaLevel] = useState<string>(() => loadFromStorage(LS_KEYS.CA_LEVEL, 'Intermediate'));
  const [studyTarget, setStudyTarget] = useState<number>(() => loadFromStorage(LS_KEYS.STUDY_TARGET, 6));
  const [totalHours, setTotalHours] = useState<number>(() => loadFromStorage(LS_KEYS.TOTAL_HOURS, 0));
  const [progressState, setProgressState] = useState<ProgressState>(() =>
    loadFromStorage<ProgressState>(LS_KEYS.PROGRESS, buildInitialProgress())
  );
  const [fullName, setFullName] = useState<string>(() => loadFromStorage(LS_KEYS.FULL_NAME, ''));
  const [examStartDate, setExamStartDate] = useState<string>(() => loadFromStorage(LS_KEYS.EXAM_START_DATE, ''));

  // Today's study hours (resets each day)
  const [todayHours, setTodayHours] = useState<number>(() => {
    const storedKey = loadFromStorage(LS_KEYS.TODAY_DATE_KEY, '');
    const today = new Date().toISOString().split('T')[0];
    if (storedKey === today) {
      return loadFromStorage(LS_KEYS.TODAY_HOURS, 0);
    }
    return 0;
  });

  // Lifted states
  const [slots, setSlots] = useState<ScheduleSlot[]>(() => loadFromStorage(LS_KEYS.SLOTS, []));
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage(LS_KEYS.TASKS, []));
  const [revisions, setRevisions] = useState<RevisionItem[]>(() => loadFromStorage(LS_KEYS.REVISIONS, []));
  const [mistakes, setMistakes] = useState<Mistake[]>(() => loadFromStorage(LS_KEYS.MISTAKES, []));

  // Persist all state changes to localStorage
  useEffect(() => { saveToStorage(LS_KEYS.PROGRESS, progressState); }, [progressState]);
  useEffect(() => { saveToStorage(LS_KEYS.CA_LEVEL, caLevel); }, [caLevel]);
  useEffect(() => { saveToStorage(LS_KEYS.STUDY_TARGET, studyTarget); }, [studyTarget]);
  useEffect(() => { saveToStorage(LS_KEYS.TOTAL_HOURS, totalHours); }, [totalHours]);
  useEffect(() => { saveToStorage(LS_KEYS.FULL_NAME, fullName); }, [fullName]);
  useEffect(() => { saveToStorage(LS_KEYS.EXAM_START_DATE, examStartDate); }, [examStartDate]);
  useEffect(() => {
    saveToStorage(LS_KEYS.TODAY_HOURS, todayHours);
    saveToStorage(LS_KEYS.TODAY_DATE_KEY, new Date().toISOString().split('T')[0]);
  }, [todayHours]);
  useEffect(() => { saveToStorage(LS_KEYS.SLOTS, slots); }, [slots]);
  useEffect(() => { saveToStorage(LS_KEYS.TASKS, tasks); }, [tasks]);
  useEffect(() => { saveToStorage(LS_KEYS.REVISIONS, revisions); }, [revisions]);
  useEffect(() => { saveToStorage(LS_KEYS.MISTAKES, mistakes); }, [mistakes]);

  // ---- Supabase cloud backup sync ----
  const syncTimerRef = useRef<number | null>(null);
  const hasSyncedRef = useRef(false); // prevent double-load on mount

  // Ref to always hold the latest state values for loadCloudData callbacks without stale closure issues
  const stateRef = useRef({ progressState, caLevel, studyTarget, totalHours, slots, tasks, revisions, mistakes, fullName, examStartDate });
  useEffect(() => {
    stateRef.current = { progressState, caLevel, studyTarget, totalHours, slots, tasks, revisions, mistakes, fullName, examStartDate };
  }, [progressState, caLevel, studyTarget, totalHours, slots, tasks, revisions, mistakes, fullName, examStartDate]);

  // Load cloud data on login (restores progress on new device)
  const loadCloudData = useCallback(async (userId: string) => {
    if (hasSyncedRef.current) return;

    try {
      const cloud = await loadFromSupabase(userId);
      hasSyncedRef.current = true; // only mark synced if load completed successfully (found or not found)
      if (cloud) {
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
          };
          setProgressState(packed.checklist || {});
          setTasks(packed.tasks || []);
          setRevisions(packed.revisions || []);
          setMistakes(packed.mistakes || []);
          setSlots(packed.slots || []);
          if (packed.fullName) setFullName(packed.fullName);
          if (packed.examStartDate) setExamStartDate(packed.examStartDate);
        } else {
          // Old format (just progressState)
          setProgressState(cloudState || {});
        }
        setCaLevel(cloud.ca_level);
        setStudyTarget(cloud.study_target);
        setTotalHours(cloud.total_hours);
        console.log('Progress restored from cloud backup.');
      } else {
        // No cloud data yet → push current local state as first backup
        const { progressState: ps, caLevel: cl, studyTarget: st, totalHours: th, slots: sl, tasks: tk, revisions: rv, mistakes: ms, fullName: fn, examStartDate: esd } = stateRef.current;
        
        // Pack state
        const packedProgress = {
          checklist: ps,
          tasks: tk,
          revisions: rv,
          mistakes: ms,
          slots: sl,
          fullName: fn,
          examStartDate: esd
        };

        await saveToSupabase(userId, {
          progress_state: packedProgress as unknown as ProgressState,
          ca_level: cl,
          study_target: st,
          total_hours: th,
        });
        console.log('Initial cloud backup created.');
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
        examStartDate
      };

      saveToSupabase(userId, {
        progress_state: packedProgress as unknown as ProgressState,
        ca_level: caLevel,
        study_target: studyTarget,
        total_hours: totalHours,
      });
    }, 2000); // debounce 2 seconds

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [progressState, caLevel, studyTarget, totalHours, fullName, examStartDate, tasks, revisions, mistakes, slots, session]);



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
        if (s?.user?.id) loadCloudData(s.user.id);
      }).catch((err) => {
        console.warn('Supabase getSession failed (credentials may be invalid):', err);
      });

      const { data } = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s);
        loadUserMetadata(s);
        if (s?.user?.id) loadCloudData(s.user.id);
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
                  badge: '/favicon.svg',
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

  const handleAddStudyHours = (hours: number) => {
    // Add logged study hours to session total and today's hours
    setTotalHours((prev) => parseFloat((prev + hours).toFixed(1)));
    setTodayHours((prev) => parseFloat((prev + hours).toFixed(1)));
  };

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
  };

  const handleAddSubject = (subName: string) => {
    setProgressState((prev) => {
      if (prev[subName]) return prev;
      return {
        ...prev,
        [subName]: {},
      };
    });
  };

  const handleDeleteSubject = (subName: string) => {
    setProgressState((prev) => {
      const newState = { ...prev };
      delete newState[subName];
      return newState;
    });
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

  const handleLogout = () => {
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
              />
            )}
            {activeTab === 'subjects' && (
              <Subjects
                caLevel={caLevel}
                progressState={progressState}
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
              />
            )}
            {activeTab === 'planner' && (
              <Planner
                onAddStudyHours={handleAddStudyHours}
                caLevel={caLevel}
                tasks={tasks}
                setTasks={setTasks}
                todayHours={todayHours}
              />
            )}
            {activeTab === 'analytics' && (
              <Analytics 
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
                userEmail={session.user.email || 'CA Student'}
                caLevel={caLevel}
                setCaLevel={handleUpdateCaLevel}
                studyTarget={studyTarget}
                setStudyTarget={handleUpdateStudyTarget}
                onLogout={handleLogout}
                onUpdateFullName={handleUpdateFullName}
                examStartDate={examStartDate}
                onUpdateExamStartDate={setExamStartDate}
              />
            )}
          </>
        )}
      </div>

      {/* bottom navigation bar visible only when authorized */}
      {session && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </div>
  );
}

export default App;
