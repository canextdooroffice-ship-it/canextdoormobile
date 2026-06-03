import React from 'react';
import { Target, Plus, Trash2, X, Calendar, Check, Layers, Search, BookOpen, AlertCircle } from 'lucide-react';
import type { ProgressState } from './Subjects';
import { SYLLABUS_DATA } from '../constants/syllabus';

export interface Mistake {
  id: string;
  subjectName: string;
  chapterName: string;
  category: 'Conceptual' | 'Silly' | 'Misread' | 'Time' | 'Formula';
  mistakeType: string;
  severity: string;
  whatWrong: string;
  correctApproach: string;
  rootCause: string;
  description?: string;
  createdAt: string;
}

export interface RevisionItem {
  id: string;
  subjectName: string;
  chapterName: string;
  requirement: 'REV1' | 'REV2' | 'REV3';
  dueDate: string; // YYYY-MM-DD
  completed: boolean;
  completedAt?: string;
}

interface AnalyticsProps {
  caLevel: string;
  totalHours: number;
  progressState: ProgressState;
  onToggleRevisionCycle: (subName: string, chapName: string, cycle: number) => void;
  revisions: RevisionItem[];
  setRevisions: React.Dispatch<React.SetStateAction<RevisionItem[]>>;
  mistakes: Mistake[];
  setMistakes: React.Dispatch<React.SetStateAction<Mistake[]>>;
}

const MISTAKE_CATEGORIES = ['Conceptual', 'Silly', 'Misread', 'Time', 'Formula'] as const;

const getSubjectBadge = (subjectName: string): string => {
  const name = subjectName.toLowerCase();
  if (name.includes('financial reporting')) return 'PAPER 1: FR';
  if (name.includes('advanced financial') || name.includes('afm')) return 'PAPER 2: AFM';
  if (name.includes('advanced auditing')) return 'PAPER 3: AUDIT';
  if (name.includes('direct tax')) return 'PAPER 4: DT';
  if (name.includes('indirect tax') || name.includes('gst')) return 'PAPER 5: IDT';
  
  if (name.includes('advanced accounting')) return 'PAPER 1: ADV ACC';
  if (name.includes('corporate & other')) return 'PAPER 2: LAW';
  if (name.includes('taxation')) return 'PAPER 3: TAX';
  if (name.includes('cost & management')) return 'PAPER 4: COST';
  
  // Custom or fallback
  const shorthand = subjectName.split('(')[1]?.replace(')', '').trim() || subjectName.substring(0, 8).toUpperCase();
  return shorthand;
};

export const Analytics: React.FC<AnalyticsProps> = ({ 
  caLevel,
  progressState,
  onToggleRevisionCycle,
  revisions,
  setRevisions,
  mistakes,
  setMistakes,
}) => {

  // Mistakes State passed via props

  // Modal and filters state
  const [selectedSubjectFilter, setSelectedSubjectFilter] = React.useState('All');
  const [isLogModalOpen, setIsLogModalOpen] = React.useState(false);
  const [isDrillDownOpen, setIsDrillDownOpen] = React.useState(false);

  // Form inputs
  const [logSubject, setLogSubject] = React.useState('');
  const [logChapter, setLogChapter] = React.useState('');
  const [logMistakeType, setLogMistakeType] = React.useState<string>('Conceptual Gap');
  const [logSeverity, setLogSeverity] = React.useState<string>('High (Critical)');
  const [logWhatWrong, setLogWhatWrong] = React.useState('');
  const [logCorrectApproach, setLogCorrectApproach] = React.useState('');
  const [logRootCause, setLogRootCause] = React.useState('');

  // Drilldown target
  const [drillSubject, setDrillSubject] = React.useState('');
  const [drillChapter, setDrillChapter] = React.useState('');
  const [drillCategory, setDrillCategory] = React.useState<'Conceptual' | 'Silly' | 'Misread' | 'Time' | 'Formula'>('Conceptual');

  const currentSyllabus = React.useMemo(() => {
    return (SYLLABUS_DATA[caLevel as keyof typeof SYLLABUS_DATA] || SYLLABUS_DATA.Intermediate) as Record<string, string[]>;
  }, [caLevel]);

  // List of active subjects and chapters (must belong to current level/custom and have at least 1 chapter)
  const activeSubjects = React.useMemo(() => {
    if (!progressState) return [];
    const defaultSubs = Object.keys(currentSyllabus);
    return Object.keys(progressState).filter((sub) => {
      const isDefaultCurrent = defaultSubs.includes(sub);
      const isDefaultAny = Object.values(SYLLABUS_DATA).some((levelSyllabus) =>
        Object.keys(levelSyllabus).includes(sub)
      );
      const isCustom = !isDefaultAny;
      const isActive = isDefaultCurrent || isCustom;
      if (!isActive) return false;

      // Ensure subject has at least one chapter in progressState
      const chaps = progressState[sub] ? Object.keys(progressState[sub]) : [];
      return chaps.length > 0;
    });
  }, [progressState, currentSyllabus]);

  const logChapters = React.useMemo(() => {
    if (!logSubject || !progressState || !progressState[logSubject]) return [];
    return Object.keys(progressState[logSubject]);
  }, [logSubject, progressState]);

  // Map mistakeType to matrix category
  const mapMistakeTypeToCategory = React.useCallback((type: string): 'Conceptual' | 'Silly' | 'Misread' | 'Time' | 'Formula' => {
    if (type === 'Silly Mistake') return 'Silly';
    if (type === 'Misread Question') return 'Misread';
    if (type === 'Time Pressure') return 'Time';
    if (type === 'Formula Error') return 'Formula';
    return 'Conceptual'; // Conceptual Gap
  }, []);

  const handleOpenLogModal = () => {
    if (activeSubjects.length > 0) {
      const firstSub = activeSubjects[0];
      setLogSubject(firstSub);
      const chaps = progressState[firstSub] ? Object.keys(progressState[firstSub]) : [];
      setLogChapter(chaps[0] || '');
    }
    setLogMistakeType('Conceptual Gap');
    setLogSeverity('High (Critical)');
    setLogWhatWrong('');
    setLogCorrectApproach('');
    setLogRootCause('');
    setIsLogModalOpen(true);
  };

  const handleLogSubjectChange = (sub: string) => {
    setLogSubject(sub);
    const chaps = progressState[sub] ? Object.keys(progressState[sub]) : [];
    setLogChapter(chaps[0] || '');
  };

  const handleSaveMistake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logSubject || !logChapter) {
      alert('Please select a subject and chapter.');
      return;
    }
    const newMistake: Mistake = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      subjectName: logSubject,
      chapterName: logChapter,
      category: mapMistakeTypeToCategory(logMistakeType),
      mistakeType: logMistakeType,
      severity: logSeverity,
      whatWrong: logWhatWrong.trim(),
      correctApproach: logCorrectApproach.trim(),
      rootCause: logRootCause.trim(),
      createdAt: new Date().toISOString(),
    };
    setMistakes((prev) => [newMistake, ...prev]);
    setIsLogModalOpen(false);
  };

  const handleDeleteMistake = (id: string) => {
    if (confirm('Are you sure you want to delete this mistake log?')) {
      setMistakes((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleCellClick = (sub: string, chap: string, cat: 'Conceptual' | 'Silly' | 'Misread' | 'Time' | 'Formula') => {
    setDrillSubject(sub);
    setDrillChapter(chap);
    setDrillCategory(cat);
    setIsDrillDownOpen(true);
  };

  // Get mistake count
  const getErrorCount = React.useCallback((sub: string, chap: string, cat: string) => {
    return mistakes.filter(
      (m) => m.subjectName === sub && m.chapterName === chap && m.category === cat
    ).length;
  }, [mistakes]);

  // Unique chapters that have mistakes logged
  const uniqueChapterRows = React.useMemo(() => {
    const rowsMap = new Map<string, { subjectName: string; chapterName: string }>();
    
    mistakes.forEach((m) => {
      // Filter out orphaned mistakes
      if (!activeSubjects.includes(m.subjectName)) return;
      if (!progressState[m.subjectName]?.[m.chapterName]) return;

      if (selectedSubjectFilter !== 'All' && m.subjectName !== selectedSubjectFilter) {
        return;
      }
      const key = `${m.subjectName}::${m.chapterName}`;
      if (!rowsMap.has(key)) {
        rowsMap.set(key, { subjectName: m.subjectName, chapterName: m.chapterName });
      }
    });

    return Array.from(rowsMap.values());
  }, [mistakes, activeSubjects, progressState, selectedSubjectFilter]);

  // Mistakes for the active drill down
  const filteredDrillMistakes = React.useMemo(() => {
    return mistakes.filter(
      (m) => m.subjectName === drillSubject && 
             m.chapterName === drillChapter && 
             m.category === drillCategory
    );
  }, [mistakes, drillSubject, drillChapter, drillCategory]);

  const getCellBgColor = (count: number) => {
    if (count <= 0) return 'transparent';
    if (count === 1) return 'rgba(99, 102, 241, 0.12)';
    if (count === 2) return 'rgba(99, 102, 241, 0.35)';
    if (count === 3) return 'rgba(99, 102, 241, 0.6)';
    return 'rgba(99, 102, 241, 0.85)';
  };

  const getCellTextColor = (count: number) => {
    if (count <= 0) return 'transparent';
    if (count >= 3) return '#ffffff';
    return '#4f46e5';
  };

  // ==========================================
  // REVISION PLANNER LOGIC
  // ==========================================

  // Revisions State passed via props

  const [activeQueueTab, setActiveQueueTab] = React.useState<'ALL' | 'LATE' | 'TODAY' | 'UPCOMING'>('ALL');
  const [revisionSearchQuery, setRevisionSearchQuery] = React.useState('');
  const [revisionSubjectFilter, setRevisionSubjectFilter] = React.useState('All');
  const [isAddRevisionModalOpen, setIsAddRevisionModalOpen] = React.useState(false);

  // Form states for Add Revision Item
  const [addSubject, setAddSubject] = React.useState('');
  const [addChapter, setAddChapter] = React.useState('');
  const [addRequirement, setAddRequirement] = React.useState<'REV1' | 'REV2' | 'REV3'>('REV1');
  const [addDueDate, setAddDueDate] = React.useState(() => new Date().toISOString().split('T')[0]);

  const addChapters = React.useMemo(() => {
    if (!addSubject || !progressState || !progressState[addSubject]) return [];
    return Object.keys(progressState[addSubject]);
  }, [addSubject, progressState]);

  const handleOpenAddRevisionModal = () => {
    if (activeSubjects.length > 0) {
      const firstSub = activeSubjects[0];
      setAddSubject(firstSub);
      const chaps = progressState[firstSub] ? Object.keys(progressState[firstSub]) : [];
      setAddChapter(chaps[0] || '');
    }
    setAddRequirement('REV1');
    setAddDueDate(new Date().toISOString().split('T')[0]);
    setIsAddRevisionModalOpen(true);
  };

  const handleAddSubjectChange = (sub: string) => {
    setAddSubject(sub);
    const chaps = progressState[sub] ? Object.keys(progressState[sub]) : [];
    setAddChapter(chaps[0] || '');
  };

  const todayStr = React.useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const getDaysDiff = React.useCallback((dateStr1: string, dateStr2: string) => {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    d1.setHours(0,0,0,0);
    d2.setHours(0,0,0,0);
    const diffTime = d1.getTime() - d2.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  const revisionStats = React.useMemo(() => {
    let late = 0;
    let todayCount = 0;
    let upcoming = 0;

    revisions.forEach((r) => {
      if (r.completed) return;
      // Filter out orphaned revisions
      if (!activeSubjects.includes(r.subjectName)) return;
      if (!progressState[r.subjectName]?.[r.chapterName]) return;

      const diff = getDaysDiff(todayStr, r.dueDate);
      if (diff > 0) {
        late++;
      } else if (diff === 0) {
        todayCount++;
      } else {
        upcoming++;
      }
    });

    return { late, todayCount, upcoming };
  }, [revisions, activeSubjects, progressState, todayStr, getDaysDiff]);

  const filteredRevisions = React.useMemo(() => {
    return revisions.filter((r) => {
      if (r.completed) return false;
      // Filter out orphaned revisions
      if (!activeSubjects.includes(r.subjectName)) return false;
      if (!progressState[r.subjectName]?.[r.chapterName]) return false;

      if (revisionSubjectFilter !== 'All' && r.subjectName !== revisionSubjectFilter) {
        return false;
      }
      if (revisionSearchQuery.trim() !== '') {
        const query = revisionSearchQuery.toLowerCase();
        const matchesChapter = r.chapterName.toLowerCase().includes(query);
        const matchesSubject = r.subjectName.toLowerCase().includes(query);
        if (!matchesChapter && !matchesSubject) return false;
      }
      const diff = getDaysDiff(todayStr, r.dueDate);
      if (activeQueueTab === 'LATE' && diff <= 0) return false;
      if (activeQueueTab === 'TODAY' && diff !== 0) return false;
      if (activeQueueTab === 'UPCOMING' && diff >= 0) return false;

      return true;
    }).sort((a, b) => {
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [revisions, activeSubjects, progressState, revisionSubjectFilter, revisionSearchQuery, activeQueueTab, todayStr, getDaysDiff]);

  const handleCompleteRevision = (id: string) => {
    const item = revisions.find((r) => r.id === id);
    if (!item) return;

    setRevisions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, completed: true, completedAt: new Date().toISOString() } : r))
    );

    const cycleNumber = item.requirement === 'REV3' ? 3 : item.requirement === 'REV2' ? 2 : 1;
    onToggleRevisionCycle(item.subjectName, item.chapterName, cycleNumber);
  };

  const handleSaveRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSubject || !addChapter) {
      alert('Please select a subject and chapter.');
      return;
    }
    const newItem: RevisionItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      subjectName: addSubject,
      chapterName: addChapter,
      requirement: addRequirement,
      dueDate: addDueDate,
      completed: false,
    };
    setRevisions((prev) => [newItem, ...prev]);
    setIsAddRevisionModalOpen(false);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="analytics-container fade-in">
      {/* ERROR DENSITY MATRIX (Mistake Book) */}
      <div className="analytics-card error-density-card">
        <div className="matrix-header-row">
          <div>
            <div className="matrix-title-wrap">
              <Target className="matrix-title-icon" size={20} />
              <h3 className="card-title">Error Density Matrix</h3>
            </div>
            <p className="card-subtitle">Identify weak areas and click colored cells to drill down.</p>
          </div>
          <button 
            type="button" 
            className="log-mistake-trigger-btn"
            onClick={handleOpenLogModal}
          >
            <Plus size={16} />
            <span>Log New Mistake</span>
          </button>
        </div>

        <div className="matrix-filter-key-row">
          <div className="matrix-filter-group">
            <span className="filter-label">FILTER SUBJECT:</span>
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="matrix-subject-select"
            >
              <option value="All">All Subjects (Full Matrix)</option>
              {activeSubjects.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
          
          <div className="matrix-frequency-key">
            <span className="key-label">LOW FREQUENCY</span>
            <div className="key-block" style={{ backgroundColor: getCellBgColor(1) }} />
            <div className="key-block" style={{ backgroundColor: getCellBgColor(2) }} />
            <div className="key-block" style={{ backgroundColor: getCellBgColor(3) }} />
            <span className="key-label">HIGH FREQUENCY</span>
          </div>
        </div>

        <div className="matrix-table-outer">
          <div className="matrix-table-scroll">
            <div className="matrix-grid-table">
              {/* Header Row */}
              <div className="matrix-grid-row header">
                <div className="matrix-grid-col label-col">SUBJECT & CHAPTER</div>
                {MISTAKE_CATEGORIES.map((cat) => (
                  <div key={cat} className="matrix-grid-col cell-col header-cell">{cat.toUpperCase()}</div>
                ))}
              </div>

              {/* Rows */}
              {uniqueChapterRows.length === 0 ? (
                <div className="matrix-empty-state-row">
                  <p className="matrix-empty-state-text">
                    No mistakes logged for the selected filter. Click <strong>+ Log New Mistake</strong> to start analyzing your weak areas!
                  </p>
                </div>
              ) : (
                uniqueChapterRows.map((row, index) => (
                  <div key={index} className="matrix-grid-row">
                    <div className="matrix-grid-col label-col">
                      <span className="subject-paper-badge">{getSubjectBadge(row.subjectName)}</span>
                      <span className="chapter-label-text">{row.chapterName}</span>
                    </div>
                    {MISTAKE_CATEGORIES.map((cat) => {
                      const count = getErrorCount(row.subjectName, row.chapterName, cat);
                      const hasCount = count > 0;
                      return (
                        <div 
                          key={cat} 
                          className={`matrix-grid-col cell-col`}
                        >
                          {hasCount ? (
                            <button
                              type="button"
                              className="matrix-cell-box has-errors"
                              style={{ backgroundColor: getCellBgColor(count), color: getCellTextColor(count) }}
                              onClick={() => handleCellClick(row.subjectName, row.chapterName, cat)}
                            >
                              {count}
                            </button>
                          ) : (
                            <div className="matrix-cell-box empty" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* REVISION PLANNER CARD */}
      <div className="analytics-card revision-planner-card mt-4">
        <div className="matrix-header-row flex-col-mobile">
          <div>
            <div className="matrix-title-wrap">
              <Calendar className="matrix-title-icon" size={20} />
              <span className="filter-label" style={{ color: 'var(--accent-primary)', fontSize: '11px', letterSpacing: '0.08em' }}>REVISION PLANNER</span>
            </div>
            <h3 className="card-title mt-1" style={{ fontSize: '22px', fontWeight: '800' }}>Master Your Schedule</h3>
            <p className="card-subtitle mt-1">
              Track chapters due for revision today and stay ahead of the curve. Today is <strong>{todayStr}</strong>.
            </p>
          </div>

          <div className="revision-header-right">
            <div className="revision-badges-row">
              <div className="rev-badge late">
                <span className="rev-badge-dot red" />
                <span className="rev-badge-text">{revisionStats.late} Late</span>
              </div>
              <div className="rev-badge today">
                <span className="rev-badge-dot green" />
                <span className="rev-badge-text">{revisionStats.todayCount} Due Today</span>
              </div>
              <div className="rev-badge upcoming">
                <span className="rev-badge-dot blue" />
                <span className="rev-badge-text">{revisionStats.upcoming} Upcoming</span>
              </div>
            </div>

            <button 
              type="button" 
              className="log-mistake-trigger-btn add-items-btn"
              onClick={handleOpenAddRevisionModal}
            >
              <Plus size={16} />
              <span>Add Items</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar Row */}
        <div className="revision-controls-row">
          <div className="action-queue-label-wrap">
            <span className="action-queue-lbl">Action Queue</span>
            <div className="action-queue-tabs">
              {(['ALL', 'LATE', 'TODAY', 'UPCOMING'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`queue-tab-btn ${activeQueueTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveQueueTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="revision-filters-group">
            <select
              value={revisionSubjectFilter}
              onChange={(e) => setRevisionSubjectFilter(e.target.value)}
              className="matrix-subject-select revision-sub-select"
            >
              <option value="All">All Subjects</option>
              {activeSubjects.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>

            <div className="revision-search-wrap">
              <Search className="revision-search-icon" size={14} />
              <input
                type="text"
                placeholder="Search chapters..."
                value={revisionSearchQuery}
                onChange={(e) => setRevisionSearchQuery(e.target.value)}
                className="revision-search-input"
              />
            </div>
          </div>
        </div>

        {/* Revisions Table Grid */}
        <div className="matrix-table-outer mt-3">
          <div className="matrix-table-scroll">
            <div className="matrix-grid-table revision-table">
              {/* Header */}
              <div className="matrix-grid-row header">
                <div className="matrix-grid-col rev-col-subject">SUBJECT & CHAPTER</div>
                <div className="matrix-grid-col rev-col-req header-cell">REQUIREMENT</div>
                <div className="matrix-grid-col rev-col-timeline header-cell">TIMELINE</div>
                <div className="matrix-grid-col rev-col-action header-cell">ACTION</div>
              </div>

              {/* Rows */}
              {filteredRevisions.length === 0 ? (
                <div className="matrix-empty-state-row">
                  <p className="matrix-empty-state-text">
                    No revision items found in this queue. Revisions help you keep your preparation perfect!
                  </p>
                </div>
              ) : (
                filteredRevisions.map((item) => {
                  const diff = getDaysDiff(todayStr, item.dueDate);
                  return (
                    <div key={item.id} className="matrix-grid-row revision-row">
                      {/* Column 1: Book icon + Chapter name / Subject paper */}
                      <div className="matrix-grid-col rev-col-subject">
                        <div className="rev-subject-cell-wrap">
                          <div className="rev-book-icon-badge">
                            <BookOpen size={15} />
                          </div>
                          <div className="rev-subject-text-wrap">
                            <span className="rev-chapter-title">{item.chapterName}</span>
                            <span className="rev-subject-subtitle">{getSubjectBadge(item.subjectName)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Column 2: Requirement Badge */}
                      <div className="matrix-grid-col rev-col-req">
                        <span className="rev-req-pill">
                          <Layers size={11} />
                          <span>{item.requirement}</span>
                        </span>
                      </div>

                      {/* Column 3: Timeline status */}
                      <div className="matrix-grid-col rev-col-timeline">
                        {diff > 0 ? (
                          <div className="rev-timeline-status late">
                            <span className="rev-timeline-title">
                              <AlertCircle size={12} className="inline-icon" />
                              <span>{diff} Days Late</span>
                            </span>
                            <span className="rev-timeline-sub">Was due {item.dueDate}</span>
                          </div>
                        ) : diff === 0 ? (
                          <div className="rev-timeline-status today">
                            <span className="rev-timeline-title">Due Today</span>
                            <span className="rev-timeline-sub">Review it today</span>
                          </div>
                        ) : (
                          <div className="rev-timeline-status upcoming">
                            <span className="rev-timeline-title">In {Math.abs(diff)} Days</span>
                            <span className="rev-timeline-sub">Due {item.dueDate}</span>
                          </div>
                        )}
                      </div>

                      {/* Column 4: Action check button */}
                      <div className="matrix-grid-col rev-col-action">
                        <button
                          type="button"
                          className="rev-complete-action-btn"
                          onClick={() => handleCompleteRevision(item.id)}
                          title="Mark Revision Complete"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LOG MISTAKE MODAL */}
      {isLogModalOpen && (
        <div className="matrix-modal-overlay" onClick={() => setIsLogModalOpen(false)}>
          <div className="matrix-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="matrix-modal-header">
              <h4 className="matrix-modal-title">Log New Mistake</h4>
              <button 
                type="button" 
                className="matrix-modal-close-btn" 
                onClick={() => setIsLogModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveMistake} className="matrix-modal-form">
              <div className="profile-form-grid">
                <div className="input-group">
                  <label>Subject</label>
                  <select 
                    value={logSubject} 
                    onChange={(e) => handleLogSubjectChange(e.target.value)}
                    className="styled-select-field"
                    required
                  >
                    {activeSubjects.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label>Chapter</label>
                  <select 
                    value={logChapter} 
                    onChange={(e) => setLogChapter(e.target.value)}
                    className="styled-select-field"
                    required
                  >
                    {logChapters.map((chap) => (
                      <option key={chap} value={chap}>{chap}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="profile-form-grid mt-3">
                <div className="input-group">
                  <label>Mistake Type</label>
                  <select
                    value={logMistakeType}
                    onChange={(e) => setLogMistakeType(e.target.value)}
                    className="styled-select-field"
                    required
                  >
                    <option value="Conceptual Gap">Conceptual Gap</option>
                    <option value="Silly Mistake">Silly Mistake</option>
                    <option value="Misread Question">Misread Question</option>
                    <option value="Time Pressure">Time Pressure</option>
                    <option value="Formula Error">Formula Error</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Severity</label>
                  <select
                    value={logSeverity}
                    onChange={(e) => setLogSeverity(e.target.value)}
                    className="styled-select-field"
                    required
                  >
                    <option value="High (Critical)">High (Critical)</option>
                    <option value="Medium (Warning)">Medium (Warning)</option>
                    <option value="Low (Minor)">Low (Minor)</option>
                  </select>
                </div>
              </div>

              <div className="input-group mt-3">
                <label>What I Did Wrong</label>
                <textarea
                  value={logWhatWrong}
                  onChange={(e) => setLogWhatWrong(e.target.value)}
                  className="styled-textarea-field"
                  placeholder="Describe your incorrect approach or thought process..."
                  rows={3}
                  required
                />
              </div>

              <div className="input-group mt-3">
                <label>Correct Approach</label>
                <textarea
                  value={logCorrectApproach}
                  onChange={(e) => setLogCorrectApproach(e.target.value)}
                  className="styled-textarea-field"
                  placeholder="The right method, rule, or concept to remember for next time..."
                  rows={3}
                  required
                />
              </div>

              <div className="input-group mt-3">
                <label>Root Cause (Self Reflection)</label>
                <input
                  type="text"
                  value={logRootCause}
                  onChange={(e) => setLogRootCause(e.target.value)}
                  className="styled-text-input-field"
                  placeholder="Why did this happen? (e.g., missed adjusting for opening balance)"
                  required
                />
              </div>

              <div className="matrix-modal-actions mt-4">
                <button type="submit" className="matrix-modal-save-btn">
                  Save Mistake Log
                </button>
                <button 
                  type="button" 
                  className="matrix-modal-cancel-btn" 
                  onClick={() => setIsLogModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRILL DOWN MODAL */}
      {isDrillDownOpen && (
        <div className="matrix-modal-overlay" onClick={() => setIsDrillDownOpen(false)}>
          <div className="matrix-modal-card drilldown" onClick={(e) => e.stopPropagation()}>
            <div className="matrix-modal-header">
              <div>
                <h4 className="matrix-modal-title">{drillCategory} Mistakes</h4>
                <p className="matrix-modal-subtitle">
                  {drillChapter} • <span className="text-purple-badge">{getSubjectBadge(drillSubject)}</span>
                </p>
              </div>
              <button 
                type="button" 
                className="matrix-modal-close-btn" 
                onClick={() => setIsDrillDownOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="drilldown-list-container">
              {filteredDrillMistakes.length === 0 ? (
                <div className="drilldown-empty">
                  <p>No mistakes logged under this category anymore.</p>
                </div>
              ) : (
                <div className="drilldown-list">
                  {filteredDrillMistakes.map((m) => (
                    <div key={m.id} className="drilldown-card-item">
                      <div className="drilldown-card-body">
                        <div className="drilldown-item-header">
                          <span className="drilldown-card-date">{formatDate(m.createdAt)}</span>
                          <span className={`severity-badge ${m.severity ? m.severity.toLowerCase().replace(/[^a-z]/g, '') : 'mediumwarning'}`}>
                            {m.severity || 'Medium (Warning)'}
                          </span>
                        </div>

                        <div className="drilldown-detail-section mt-1">
                          <span className="drilldown-section-title">WHAT I DID WRONG:</span>
                          <p className="drilldown-card-desc">{m.whatWrong || m.description || 'No description provided.'}</p>
                        </div>

                        {m.correctApproach && (
                          <div className="drilldown-detail-section mt-2">
                            <span className="drilldown-section-title">CORRECT APPROACH:</span>
                            <p className="drilldown-card-desc-success">{m.correctApproach}</p>
                          </div>
                        )}

                        {m.rootCause && (
                          <div className="drilldown-detail-section mt-2">
                            <span className="drilldown-section-title">ROOT CAUSE:</span>
                            <p className="drilldown-card-desc-neutral">{m.rootCause}</p>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="drilldown-card-delete-btn"
                        onClick={() => handleDeleteMistake(m.id)}
                        title="Delete log"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="matrix-modal-actions mt-3">
              <button 
                type="button" 
                className="matrix-modal-cancel-btn full-width" 
                onClick={() => setIsDrillDownOpen(false)}
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD REVISION MODAL */}
      {isAddRevisionModalOpen && (
        <div className="matrix-modal-overlay" onClick={() => setIsAddRevisionModalOpen(false)}>
          <div className="matrix-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="matrix-modal-header">
              <h4 className="matrix-modal-title">Add Revision Item</h4>
              <button 
                type="button" 
                className="matrix-modal-close-btn" 
                onClick={() => setIsAddRevisionModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveRevision} className="matrix-modal-form">
              <div className="profile-form-grid">
                <div className="input-group">
                  <label>Subject</label>
                  <select 
                    value={addSubject} 
                    onChange={(e) => handleAddSubjectChange(e.target.value)}
                    className="styled-select-field"
                    required
                  >
                    {activeSubjects.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label>Chapter</label>
                  <select 
                    value={addChapter} 
                    onChange={(e) => setAddChapter(e.target.value)}
                    className="styled-select-field"
                    required
                  >
                    {addChapters.map((chap) => (
                      <option key={chap} value={chap}>{chap}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="profile-form-grid mt-3">
                <div className="input-group">
                  <label>Requirement</label>
                  <select
                    value={addRequirement}
                    onChange={(e) => setAddRequirement(e.target.value as 'REV1' | 'REV2' | 'REV3')}
                    className="styled-select-field"
                    required
                  >
                    <option value="REV1">Revision 1 (REV1)</option>
                    <option value="REV2">Revision 2 (REV2)</option>
                    <option value="REV3">Revision 3 (REV3)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={addDueDate}
                    onChange={(e) => setAddDueDate(e.target.value)}
                    className="styled-date-input-field"
                    required
                  />
                </div>
              </div>

              <div className="matrix-modal-actions mt-4">
                <button type="submit" className="matrix-modal-save-btn">
                  Add to Queue
                </button>
                <button 
                  type="button" 
                  className="matrix-modal-cancel-btn" 
                  onClick={() => setIsAddRevisionModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
