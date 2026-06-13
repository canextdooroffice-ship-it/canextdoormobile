import React, { useState, useMemo } from 'react';
import { ArrowLeft, Search, BookOpen } from 'lucide-react';
import { SYLLABUS_DATA } from '../constants/syllabus';
import type { ProgressState } from './Subjects';
import type { StudyLog } from './Planner';

interface TimeManagerProps {
  caLevel: string;
  progressState: ProgressState;
  studyLogs: StudyLog[];
  onBack: () => void;
}

interface AggregatedTime {
  class: number;
  r1: number;
  r2: number;
  r3: number;
}

export const TimeManager: React.FC<TimeManagerProps> = ({
  caLevel,
  progressState,
  studyLogs,
  onBack,
}) => {
  const currentSyllabus = (SYLLABUS_DATA[caLevel as keyof typeof SYLLABUS_DATA] || SYLLABUS_DATA.Intermediate) as Record<string, string[]>;

  // Get active subjects
  const subjectsList = useMemo(() => {
    const defaultSubs = Object.keys(currentSyllabus);
    return Object.keys(progressState).filter((sub) => {
      const isDefaultCurrent = defaultSubs.includes(sub);
      const isDefaultAny = Object.values(SYLLABUS_DATA).some((levelSyllabus) =>
        Object.keys(levelSyllabus).includes(sub)
      );
      const isCustom = !isDefaultAny;
      return isDefaultCurrent || isCustom;
    });
  }, [progressState, caLevel]);

  // Selected Subject State
  const [activeSubject, setActiveSubject] = useState<string>(() => subjectsList[0] || '');
  const [chapterSearchQuery, setChapterSearchQuery] = useState('');

  // Auto-select first subject if activeSubject becomes invalid
  React.useEffect(() => {
    if (subjectsList.length > 0 && (!activeSubject || !subjectsList.includes(activeSubject))) {
      setActiveSubject(subjectsList[0]);
    }
  }, [subjectsList, activeSubject]);

  // Parser: Extract subject, chapter, and phase from study log labels
  const parsedLogs = useMemo(() => {
    const data: { [sub: string]: { [chap: string]: AggregatedTime } } = {};

    // Initialize data structure for active subjects & chapters
    subjectsList.forEach(sub => {
      data[sub] = {};
      const chaps = progressState[sub] ? Object.keys(progressState[sub]) : (currentSyllabus[sub] || []);
      chaps.forEach(chap => {
        data[sub][chap] = { class: 0, r1: 0, r2: 0, r3: 0 };
      });
      // Always ensure a fallback 'General' chapter exists
      data[sub]['General'] = { class: 0, r1: 0, r2: 0, r3: 0 };
    });

    studyLogs.forEach(log => {
      const label = log.label || '';
      const cleanLabel = label.replace(/^Pomodoro:\s*/i, '').trim();

      let subject = '';
      let chapter = 'General';
      let phase = 'Self Study';

      // Parse: "Subject - Chapter (Phase)"
      const matchPattern = /^(.+?)\s*-\s*(.+?)\s*\((.+?)\)$/;
      const match = cleanLabel.match(matchPattern);

      if (match) {
        subject = match[1].trim();
        chapter = match[2].trim();
        phase = match[3].trim();
      } else {
        // Parse: "Subject (Phase)"
        const matchNoChap = /^(.+?)\s*\((.+?)\)$/;
        const match2 = cleanLabel.match(matchNoChap);
        if (match2) {
          subject = match2[1].trim();
          phase = match2[2].trim();
        } else {
          // Parse: "Subject • Chapter"
          const matchDot = /^(.+?)\s*•\s*(.+)$/;
          const match3 = cleanLabel.match(matchDot);
          if (match3) {
            subject = match3[1].trim();
            chapter = match3[2].trim();
          } else {
            subject = cleanLabel;
          }
        }
      }

      // Check if this subject is in our list
      const matchedSubject = subjectsList.find(s => s.toLowerCase() === subject.toLowerCase());
      if (!matchedSubject) return;

      // Check if this chapter is in our list
      const chaptersList = Object.keys(progressState[matchedSubject] || {});
      const matchedChapter = chaptersList.find(c => c.toLowerCase() === chapter.toLowerCase()) || 'General';

      // Determine phase bucket
      const phaseLower = phase.toLowerCase();
      let bucket: keyof AggregatedTime = 'class';
      if (phaseLower.includes('revision 1') || phaseLower === 'r1' || phaseLower === 'rev1') {
        bucket = 'r1';
      } else if (phaseLower.includes('revision 2') || phaseLower === 'r2' || phaseLower === 'rev2') {
        bucket = 'r2';
      } else if (phaseLower.includes('revision 3') || phaseLower === 'r3' || phaseLower === 'rev3') {
        bucket = 'r3';
      } else if (phaseLower.includes('class') || phaseLower.includes('lecture')) {
        bucket = 'class';
      } else {
        // Default bucket for general/self study
        bucket = 'class';
      }

      if (!data[matchedSubject]) {
        data[matchedSubject] = {};
      }
      if (!data[matchedSubject][matchedChapter]) {
        data[matchedSubject][matchedChapter] = { class: 0, r1: 0, r2: 0, r3: 0 };
      }

      data[matchedSubject][matchedChapter][bucket] += log.hours;
    });

    return data;
  }, [studyLogs, subjectsList, progressState, currentSyllabus]);

  // Subject-level total time taken
  const subjectTotals = useMemo(() => {
    const totals: AggregatedTime = { class: 0, r1: 0, r2: 0, r3: 0 };
    if (!activeSubject || !parsedLogs[activeSubject]) return totals;

    Object.values(parsedLogs[activeSubject]).forEach(time => {
      totals.class += time.class;
      totals.r1 += time.r1;
      totals.r2 += time.r2;
      totals.r3 += time.r3;
    });

    return totals;
  }, [activeSubject, parsedLogs]);

  // Chapters list for active subject
  const activeChaptersList = useMemo(() => {
    if (!activeSubject) return [];
    
    // Get chapters from progressState (which handles dynamic additions/removals)
    const chaps = progressState[activeSubject] 
      ? Object.keys(progressState[activeSubject]) 
      : (currentSyllabus[activeSubject] || []);

    // Filter by search query
    return chaps.filter(chap => 
      chap.toLowerCase().includes(chapterSearchQuery.toLowerCase())
    );
  }, [activeSubject, progressState, currentSyllabus, chapterSearchQuery]);

  // Get aggregated hours for a specific chapter
  const getChapterHours = (chapter: string): AggregatedTime => {
    if (!activeSubject || !parsedLogs[activeSubject] || !parsedLogs[activeSubject][chapter]) {
      return { class: 0, r1: 0, r2: 0, r3: 0 };
    }
    return parsedLogs[activeSubject][chapter];
  };

  const formatHours = (hrs: number): string => {
    if (hrs <= 0) return '—';
    return `${hrs.toFixed(1)}h`;
  };

  return (
    <div className="time-manager-container fade-in">
      {/* Header */}
      <div className="time-manager-header-bar">
        <button 
          type="button" 
          className="time-manager-back-btn" 
          onClick={onBack}
          aria-label="Back to Tools"
        >
          <ArrowLeft size={16} />
          <span>Tools</span>
        </button>
        <h2 className="time-manager-header-title">Time Manager</h2>
      </div>

      {subjectsList.length === 0 ? (
        <div className="time-manager-empty-state">
          <BookOpen size={40} className="empty-icon" />
          <h3>No Active Subjects</h3>
          <p>Please setup your subjects in the Subjects tab first.</p>
        </div>
      ) : (
        <>
          {/* Horizontal scrollable subjects bar */}
          <div className="time-manager-subject-scroll">
            {subjectsList.map(sub => {
              const cleanedName = sub.replace(/^Paper \d+:\s*/i, '');
              const isActive = activeSubject === sub;
              return (
                <button
                  key={sub}
                  type="button"
                  className={`time-manager-subject-tab ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSubject(sub);
                    setChapterSearchQuery('');
                  }}
                  title={sub}
                >
                  {cleanedName}
                </button>
              );
            })}
          </div>

          {/* Top Heading Widget: Subject name on left, totals on right */}
          <div className="time-manager-summary-card">
            <div className="summary-left">
              <span className="summary-badge">{caLevel} Syllabus</span>
              <h3 className="summary-subject-title" title={activeSubject}>
                {activeSubject.replace(/^Paper \d+:\s*/i, '')}
              </h3>
            </div>
            
            <div className="summary-right-totals">
              <div className="total-stat-box class">
                <span className="stat-label">CLASS</span>
                <span className="stat-value">{subjectTotals.class.toFixed(1)}h</span>
              </div>
              <div className="total-stat-box r1">
                <span className="stat-label">R1</span>
                <span className="stat-value">{subjectTotals.r1.toFixed(1)}h</span>
              </div>
              <div className="total-stat-box r2">
                <span className="stat-label">R2</span>
                <span className="stat-value">{subjectTotals.r2.toFixed(1)}h</span>
              </div>
              <div className="total-stat-box r3">
                <span className="stat-label">R3</span>
                <span className="stat-value">{subjectTotals.r3.toFixed(1)}h</span>
              </div>
            </div>
          </div>

          {/* Chapter Search Bar */}
          <div className="time-manager-search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search chapters..."
              value={chapterSearchQuery}
              onChange={(e) => setChapterSearchQuery(e.target.value)}
              className="time-manager-search-input"
            />
          </div>

          {/* Chapters Table */}
          <div className="time-manager-table-card">
            {/* Table Header */}
            <div className="time-table-header">
              <div className="col-chapter">CHAPTERS</div>
              <div className="col-hours-header">CLASS</div>
              <div className="col-hours-header">R1</div>
              <div className="col-hours-header">R2</div>
              <div className="col-hours-header">R3</div>
            </div>

            {/* Table Body */}
            <div className="time-table-body">
              {activeChaptersList.length === 0 ? (
                <div className="time-table-empty">
                  <span>No chapters match search filters.</span>
                </div>
              ) : (
                activeChaptersList.map(chap => {
                  const hrs = getChapterHours(chap);
                  const isAnyHours = hrs.class > 0 || hrs.r1 > 0 || hrs.r2 > 0 || hrs.r3 > 0;
                  return (
                    <div 
                      key={chap} 
                      className={`time-table-row ${isAnyHours ? 'has-hours' : ''}`}
                    >
                      <div className="col-chapter-name" title={chap}>
                        {chap}
                      </div>
                      <div className={`col-hours class ${hrs.class > 0 ? 'highlighted' : ''}`}>
                        {formatHours(hrs.class)}
                      </div>
                      <div className={`col-hours r1 ${hrs.r1 > 0 ? 'highlighted' : ''}`}>
                        {formatHours(hrs.r1)}
                      </div>
                      <div className={`col-hours r2 ${hrs.r2 > 0 ? 'highlighted' : ''}`}>
                        {formatHours(hrs.r2)}
                      </div>
                      <div className={`col-hours r3 ${hrs.r3 > 0 ? 'highlighted' : ''}`}>
                        {formatHours(hrs.r3)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
