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
import { Wifi, Battery } from 'lucide-react';

// ---- localStorage persistence keys ----
const LS_KEYS = {
  PROGRESS: 'cand_progress',
  CA_LEVEL: 'cand_caLevel',
  STUDY_TARGET: 'cand_studyTarget',
  TOTAL_HOURS: 'cand_totalHours',
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
      chapters.forEach((chap, idx) => {
        // Assign priorities: first chapter Priority A, middle B, later C
        let p: 'A' | 'B' | 'C' = 'C';
        if (idx === 0 || idx === 3) p = 'A';
        else if (idx === 1) p = 'B';
        
        state[subName][chap] = {
          classDone: false,
          priority: p,
          ldrs: idx === 0, // Mock LDRS for first chapter
          revisionCycle: 0,
        };
      });
    });
  });

  // Seed default checked benchmarks to make the app look active on first mount
  if (state['Advanced Accounting']) {
    if (state['Advanced Accounting']['1. AS 10: Property, Plant and Equipment']) {
      state['Advanced Accounting']['1. AS 10: Property, Plant and Equipment'].classDone = true;
      state['Advanced Accounting']['1. AS 10: Property, Plant and Equipment'].revisionCycle = 1;
    }
    if (state['Advanced Accounting']['2. AS 19: Leases']) {
      state['Advanced Accounting']['2. AS 19: Leases'].classDone = true;
    }
    if (state['Advanced Accounting']['3. Company Financial Statements & Buybacks']) {
      state['Advanced Accounting']['3. Company Financial Statements & Buybacks'].classDone = true;
      state['Advanced Accounting']['3. Company Financial Statements & Buybacks'].revisionCycle = 2;
    }
  }
  
  // Seed CA Final benchmarks
  if (state['Financial Reporting (FR)']) {
    if (state['Financial Reporting (FR)']['1. intro to Ind As']) {
      state['Financial Reporting (FR)']['1. intro to Ind As'].classDone = true;
      state['Financial Reporting (FR)']['1. intro to Ind As'].revisionCycle = 3;
    }
    if (state['Financial Reporting (FR)']['10. Ind As-38']) {
      state['Financial Reporting (FR)']['10. Ind As-38'].classDone = true;
      state['Financial Reporting (FR)']['10. Ind As-38'].revisionCycle = 2;
    }
    if (state['Financial Reporting (FR)']['11. Ind AS-40']) {
      state['Financial Reporting (FR)']['11. Ind AS-40'].priority = 'B';
      state['Financial Reporting (FR)']['11. Ind AS-40'].revisionCycle = 1;
    }
  }

  return state;
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [currentTime, setCurrentTime] = useState<string>('12:00 PM');
  
  // CA Student settings — loaded from localStorage first, then Supabase metadata
  const [caLevel, setCaLevel] = useState<string>(() => loadFromStorage(LS_KEYS.CA_LEVEL, 'Intermediate'));
  const [studyTarget, setStudyTarget] = useState<number>(() => loadFromStorage(LS_KEYS.STUDY_TARGET, 6));
  const [totalHours, setTotalHours] = useState<number>(() => loadFromStorage(LS_KEYS.TOTAL_HOURS, 14.5));
  const [progressState, setProgressState] = useState<ProgressState>(() =>
    loadFromStorage<ProgressState>(LS_KEYS.PROGRESS, buildInitialProgress())
  );

  // Persist all state changes to localStorage
  useEffect(() => { saveToStorage(LS_KEYS.PROGRESS, progressState); }, [progressState]);
  useEffect(() => { saveToStorage(LS_KEYS.CA_LEVEL, caLevel); }, [caLevel]);
  useEffect(() => { saveToStorage(LS_KEYS.STUDY_TARGET, studyTarget); }, [studyTarget]);
  useEffect(() => { saveToStorage(LS_KEYS.TOTAL_HOURS, totalHours); }, [totalHours]);

  // ---- Supabase cloud backup sync ----
  const syncTimerRef = useRef<number | null>(null);
  const hasSyncedRef = useRef(false); // prevent double-load on mount

  // Ref to always hold the latest state values for loadCloudData callbacks without stale closure issues
  const stateRef = useRef({ progressState, caLevel, studyTarget, totalHours });
  useEffect(() => {
    stateRef.current = { progressState, caLevel, studyTarget, totalHours };
  }, [progressState, caLevel, studyTarget, totalHours]);

  // Load cloud data on login (restores progress on new device)
  const loadCloudData = useCallback(async (userId: string) => {
    if (hasSyncedRef.current) return;

    try {
      const cloud = await loadFromSupabase(userId);
      hasSyncedRef.current = true; // only mark synced if load completed successfully (found or not found)
      if (cloud) {
        // Cloud data exists → restore it (overrides local)
        setProgressState(cloud.progress_state);
        setCaLevel(cloud.ca_level);
        setStudyTarget(cloud.study_target);
        setTotalHours(cloud.total_hours);
        console.log('Progress restored from cloud backup.');
      } else {
        // No cloud data yet → push current local state as first backup
        const { progressState: ps, caLevel: cl, studyTarget: st, totalHours: th } = stateRef.current;
        await saveToSupabase(userId, {
          progress_state: ps,
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
      saveToSupabase(userId, {
        progress_state: progressState,
        ca_level: caLevel,
        study_target: studyTarget,
        total_hours: totalHours,
      });
    }, 2000); // debounce 2 seconds

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [progressState, caLevel, studyTarget, totalHours, session]);


  // Mock status bar clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hrs = now.getHours();
      const mins = now.getMinutes().toString().padStart(2, '0');
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      hrs = hrs % 12 || 12; // 0 hour format
      setCurrentTime(`${hrs}:${mins} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadUserMetadata = (currentSession: Session | null) => {
    if (currentSession?.user?.user_metadata) {
      const meta = currentSession.user.user_metadata;
      if (meta.ca_level) setCaLevel(meta.ca_level);
      if (meta.study_hours_target) setStudyTarget(meta.study_hours_target);
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

  const handleAddStudyHours = (hours: number) => {
    // Add logged study hours to session total
    setTotalHours((prev) => parseFloat((prev + hours).toFixed(1)));
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
      {/* simulated premium status bar */}
      <div className="phone-status-bar">
        <span>{currentTime}</span>
        <div className="status-bar-icons">
          <span className="status-dot"></span>
          <Wifi size={13} />
          <Battery size={15} />
        </div>
      </div>

      {/* Screen Content wrapper */}
      <div className="screen-content">
        {!session ? (
          <Auth onAuthSuccess={() => setActiveTab('home')} />
        ) : (
          <>
            {activeTab === 'home' && (
              <Dashboard
                userEmail={session.user.email || 'CA Student'}
                caLevel={caLevel}
                studyTarget={studyTarget}
                totalHours={totalHours}
                onStartSession={() => setActiveTab('planner')}
                progressState={progressState}
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
              />
            )}
            {activeTab === 'analytics' && (
              <Analytics totalHours={totalHours} />
            )}
            {activeTab === 'profile' && (
              <Profile
                userEmail={session.user.email || 'CA Student'}
                caLevel={caLevel}
                setCaLevel={handleUpdateCaLevel}
                studyTarget={studyTarget}
                setStudyTarget={handleUpdateStudyTarget}
                onLogout={handleLogout}
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
