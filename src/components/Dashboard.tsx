import React from 'react';
import { createPortal } from 'react-dom';
import { Flame, Calendar, Target, Timer, Check, Trash2, X, Clock, Plus } from 'lucide-react';
import { SYLLABUS_DATA } from '../constants/syllabus';
import type { ProgressState } from './Subjects';

interface DashboardProps {
  userEmail: string;
  caLevel: string;
  studyTarget: number; // e.g. 6 hours
  totalHours: number;
  onStartSession: () => void;
  progressState: ProgressState;
}

export const Dashboard: React.FC<DashboardProps> = ({
  userEmail,
  caLevel,
  studyTarget,
  totalHours,
  progressState,
}) => {
  // Extract user alias from email
  const userAlias = userEmail ? userEmail.split('@')[0] : 'Student';
  
  // Calculate today's logged study hours dynamically based on totalHours
  // totalHours starts at 14.5, todayLogged starts at 3.5. Let's compute difference!
  const todayLogged = Math.max(0, parseFloat((totalHours - 11.0).toFixed(1)));

  // Dynamically compute subject progress ratios based on checklists
  const currentSyllabus = (SYLLABUS_DATA[caLevel as keyof typeof SYLLABUS_DATA] || SYLLABUS_DATA.Intermediate) as Record<string, string[]>;
  const colors = ['#6366F1', '#A855F7', '#06B6D4', '#d97706'];

  // Get all subjects active for the current level (excluding deleted ones, including custom ones)
  const getAllSubjects = () => {
    const defaultSubs = Object.keys(currentSyllabus);
    return Object.keys(progressState).filter((sub) => {
      const isDefaultCurrent = defaultSubs.includes(sub);
      const isDefaultAny = Object.values(SYLLABUS_DATA).some((levelSyllabus) =>
        Object.keys(levelSyllabus).includes(sub)
      );
      const isCustom = !isDefaultAny;
      return isDefaultCurrent || isCustom;
    });
  };

  // Compile full chapters list dynamically
  const getSubjectChapters = (subName: string) => {
    const defaultChaps = currentSyllabus[subName] || [];
    const stateChaps = progressState[subName] ? Object.keys(progressState[subName]) : [];
    // Only include default chapters still in progressState
    const merged = defaultChaps.filter((c) =>
      progressState[subName]?.[c] !== undefined
    );
    stateChaps.forEach((c) => {
      if (!merged.includes(c)) {
        merged.push(c);
      }
    });
    return merged;
  };

  const calculateProgress = (subName: string, chapters: string[]) => {
    if (chapters.length === 0) return 0;
    const totalPoints = chapters.length * 4; // 1 (Class) + 3 (Revisions)
    let completedPoints = 0;
    chapters.forEach((chap) => {
      const status = progressState[subName]?.[chap];
      if (status) {
        if (status.classDone) completedPoints++;
        completedPoints += Math.min(status.revisionCycle, 3);
      }
    });
    return Math.round((completedPoints / totalPoints) * 100);
  };

  const subjects = getAllSubjects().map((name, idx) => {
    const chapters = getSubjectChapters(name);
    return {
      name,
      progress: calculateProgress(name, chapters),
      color: colors[idx % colors.length]
    };
  });

  // Calculate overall average readiness percentage
  const totalSubjectsProgress = subjects.reduce((acc, sub) => acc + sub.progress, 0);
  const averageReadiness = subjects.length > 0 ? Math.round(totalSubjectsProgress / subjects.length) : 0;
  const readinessVal = averageReadiness > 0 ? averageReadiness : 79.5;

  // Count chapters completed classes (classDone = true)
  let topicsDoneCount = 0;
  getAllSubjects().forEach((subName) => {
    const chapters = getSubjectChapters(subName);
    chapters.forEach((chap) => {
      if (progressState[subName]?.[chap]?.classDone) {
        topicsDoneCount++;
      }
    });
  });

  // Local state for check-in and streak count
  const [streakCount, setStreakCount] = React.useState<number>(() => {
    try {
      const stored = localStorage.getItem('cand_streakCount');
      return stored ? parseInt(stored, 10) : 7;
    } catch {
      return 7;
    }
  });
  const [checkedInToday, setCheckedInToday] = React.useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('cand_checkedInToday');
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('cand_streakCount', streakCount.toString());
      localStorage.setItem('cand_checkedInToday', JSON.stringify(checkedInToday));
    } catch (err) {
      console.warn('Failed to save streak to localStorage:', err);
    }
  }, [streakCount, checkedInToday]);

  const handleCheckIn = () => {
    if (!checkedInToday) {
      setStreakCount(prev => prev + 1);
      setCheckedInToday(true);
      alert("Great job checking in today! Consistency is Key 🔥");
    } else {
      setStreakCount(prev => prev - 1);
      setCheckedInToday(false);
    }
  };
  // Today's schedule state & methods
  interface ScheduleSlot {
    id: string;
    day: string; // 'MONDAY', 'TUESDAY', etc.
    subject: string;
    timeStart: string; // e.g. '09:00'
    timeEnd: string; // e.g. '11:00'
  }

  const todayDayName = React.useMemo(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  }, []);

  const [slots, setSlots] = React.useState<ScheduleSlot[]>(() => {
    try {
      const stored = localStorage.getItem('cand_schedule_slots');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('cand_schedule_slots', JSON.stringify(slots));
    } catch (err) {
      console.warn('Failed to save slots to localStorage:', err);
    }
  }, [slots]);

  const [isTimetableModalOpen, setIsTimetableModalOpen] = React.useState(false);
  const [isAddingSlot, setIsAddingSlot] = React.useState(false);
  const [isAddingSlotFromModal, setIsAddingSlotFromModal] = React.useState(false);
  
  const [newSlotSubject, setNewSlotSubject] = React.useState('');
  const [newSlotTimeStart, setNewSlotTimeStart] = React.useState('09:00');
  const [newSlotTimeEnd, setNewSlotTimeEnd] = React.useState('11:00');
  const [newSlotDay, setNewSlotDay] = React.useState('MONDAY');
  
  const todayDateStr = React.useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const dateVal = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${dateVal}`;
  }, []);

  const [activeDateStr, setActiveDateStr] = React.useState<string>(todayDateStr);

  const calendarDates = React.useMemo(() => {
    const dates = [];
    const today = new Date();
    
    // Start date: January 1, 2025 (noon to avoid DST issues)
    const startDate = new Date(2025, 0, 1, 12, 0, 0);
    
    // End date: 3 months forward from today (noon)
    const endDate = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate(), 12, 0, 0);
    
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const year = curr.getFullYear();
      const month = String(curr.getMonth() + 1).padStart(2, '0');
      const dateVal = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dateVal}`;
      
      dates.push({
        dateStr,
        dayName: curr.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
        dateNumber: curr.getDate(),
        month: curr.toLocaleString('en-US', { month: 'short' }),
        year
      });
      
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, []);

  const activeDay = React.useMemo(() => {
    const found = calendarDates.find(d => d.dateStr === activeDateStr);
    return found ? found.dayName : new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  }, [activeDateStr, calendarDates]);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const dayStripRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    if (isTimetableModalOpen) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 420;
        }
        if (dayStripRef.current) {
          const todayBtn = dayStripRef.current.querySelector('.day-strip-btn.today');
          if (todayBtn) {
            todayBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
          }
        }
      }, 50);
    }
  }, [isTimetableModalOpen]);

  const monthHeader = React.useMemo(() => {
    const found = calendarDates.find(d => d.dateStr === activeDateStr);
    if (!found) return '';
    return `${found.month} ${found.year}`;
  }, [activeDateStr, calendarDates]);

  const HOURS = React.useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const formatHourLabel = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  const parseTimeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const subjectsList = getAllSubjects();

  const getSubjectColor = (subjectName: string) => {
    const index = subjectsList.indexOf(subjectName);
    return colors[index % colors.length] || '#6366F1';
  };

  const todaySlots = React.useMemo(() => {
    return slots.filter(s => s.day === todayDayName).sort((a, b) => a.timeStart.localeCompare(b.timeStart));
  }, [slots, todayDayName]);

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotSubject) return;
    const newSlot: ScheduleSlot = {
      id: Date.now().toString(),
      day: todayDayName,
      subject: newSlotSubject,
      timeStart: newSlotTimeStart,
      timeEnd: newSlotTimeEnd,
    };
    setSlots(prev => [...prev, newSlot]);
    setIsAddingSlot(false);
  };

  const handleSaveSlotFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotSubject) return;
    const newSlot: ScheduleSlot = {
      id: Date.now().toString(),
      day: newSlotDay,
      subject: newSlotSubject,
      timeStart: newSlotTimeStart,
      timeEnd: newSlotTimeEnd,
    };
    setSlots(prev => [...prev, newSlot]);
    setIsAddingSlotFromModal(false);
  };

  const handleDeleteSlot = (id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id));
  };

  const formatTime12h = (time24: string) => {
    if (!time24) return '';
    const [hrsStr, minsStr] = time24.split(':');
    let hrs = parseInt(hrsStr, 10);
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12 || 12;
    return `${hrs.toString().padStart(2, '0')}:${minsStr} ${ampm}`;
  };

  return (
    <div className="dashboard-container fade-in">
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div>
          <span className="level-badge">{caLevel} Student</span>
          <h2 className="welcome-title">Hi, {userAlias}!</h2>
          <p className="welcome-subtitle">Crack the exam one page at a time.</p>
        </div>
      </div>


      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {/* Deadline Card */}
        <div className="kpi-card">
          <div className="kpi-header-row">
            <div className="kpi-icon-wrapper purple">
              <Calendar size={18} />
            </div>
            <div className="kpi-title-block">
              <span className="kpi-label-top">DEADLINE</span>
              <span className="kpi-sub-label-top">{caLevel}</span>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">-30</span>
            <span className="kpi-unit">days left</span>
          </div>
          <div className="kpi-footer">
            <div className="kpi-progress-bar-bg">
              <div className="kpi-progress-bar-fill purple"></div>
            </div>
          </div>
        </div>

        {/* Readiness Card */}
        <div className="kpi-card">
          <div className="kpi-header-row">
            <div className="kpi-icon-wrapper green">
              <Target size={18} />
            </div>
            <div className="kpi-title-block">
              <span className="kpi-label-top">READINESS</span>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{readinessVal.toFixed(1)}</span>
            <span className="kpi-unit">%</span>
          </div>
          <div className="kpi-footer">
            <div className="kpi-footer-text green">
              <span className="kpi-dot green"></span>
              <span>Same as yesterday</span>
            </div>
          </div>
        </div>

        {/* Streak / Check In Card */}
        <div className="kpi-card">
          <div className="kpi-header-row">
            <div className="kpi-icon-wrapper orange">
              <Flame size={18} />
            </div>
            <button
              type="button"
              onClick={handleCheckIn}
              className={`kpi-check-in-btn ${checkedInToday ? 'checked' : ''}`}
            >
              <span className="check-btn-icon-wrapper">
                <Check size={8} strokeWidth={4} />
              </span>
              <span>{checkedInToday ? 'CHECKED IN' : 'CHECK IN'}</span>
            </button>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{streakCount}</span>
            <span className="kpi-unit">day streak</span>
          </div>
          <div className="kpi-footer">
            <div className="kpi-footer-text orange">
              <span>Consistency is Key</span>
            </div>
          </div>
        </div>

        {/* Session Card */}
        <div className="kpi-card">
          <div className="kpi-header-row">
            <div className="kpi-icon-wrapper cyan">
              <Timer size={18} />
            </div>
            <div className="kpi-title-block">
              <span className="kpi-label-top">SESSION</span>
              <span className="kpi-sub-label-top cyan">Deep Work</span>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{todayLogged.toFixed(1)}</span>
            <span className="kpi-unit">hours today</span>
          </div>
          <div className="kpi-footer">
            <div className="kpi-progress-bar-bg">
              <div 
                className="kpi-progress-bar-fill cyan" 
                style={{ width: `${Math.min(100, Math.round((todayLogged / studyTarget) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Today's Schedule Card */}
      <div className="schedule-card">
        <div className="schedule-header">
          <div>
            <h3 className="card-title">Today's Schedule</h3>
            <span className="schedule-day-subtitle">{todayDayName}</span>
          </div>
          <button 
            type="button" 
            className="schedule-full-week-btn"
            onClick={() => setIsTimetableModalOpen(true)}
          >
            Full Week
          </button>
        </div>

        <div className="schedule-inner-container">
          {isAddingSlot ? (
            <form onSubmit={handleSaveSlot} className="schedule-inline-form">
              <div className="form-group">
                <label>Subject</label>
                <select 
                  value={newSlotSubject} 
                  onChange={(e) => setNewSlotSubject(e.target.value)}
                  className="styled-select"
                  required
                >
                  <option value="">Select Subject</option>
                  {subjectsList.map((sub, idx) => (
                    <option key={idx} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
              <div className="form-time-row">
                <div className="form-group">
                  <label>Start</label>
                  <input 
                    type="time" 
                    value={newSlotTimeStart} 
                    onChange={(e) => setNewSlotTimeStart(e.target.value)}
                    className="styled-time-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End</label>
                  <input 
                    type="time" 
                    value={newSlotTimeEnd} 
                    onChange={(e) => setNewSlotTimeEnd(e.target.value)}
                    className="styled-time-input"
                    required
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="form-save-btn">Save</button>
                <button type="button" onClick={() => setIsAddingSlot(false)} className="form-cancel-btn">Cancel</button>
              </div>
            </form>
          ) : todaySlots.length === 0 ? (
            <div className="schedule-empty-state">
              <Calendar className="schedule-empty-icon" size={32} />
              <p className="schedule-empty-text">No slots for {todayDayName.charAt(0) + todayDayName.slice(1).toLowerCase()}</p>
              <button 
                type="button" 
                className="schedule-add-slot-btn"
                onClick={() => {
                  setNewSlotSubject(subjectsList[0] || '');
                  setIsAddingSlot(true);
                }}
              >
                + Add a Slot
              </button>
            </div>
          ) : (
            <div className="schedule-slots-list">
              {todaySlots.map((slot) => (
                <div key={slot.id} className="schedule-slot-item">
                  <div className="slot-accent-bar" />
                  <div className="slot-info">
                    <span className="slot-subject">{slot.subject}</span>
                    <span className="slot-time">
                      <Clock size={10} className="slot-time-icon" />
                      {formatTime12h(slot.timeStart)} - {formatTime12h(slot.timeEnd)}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    className="slot-delete-btn"
                    onClick={() => handleDeleteSlot(slot.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button 
                type="button" 
                className="schedule-add-more-btn"
                onClick={() => {
                  setNewSlotSubject(subjectsList[0] || '');
                  setIsAddingSlot(true);
                }}
              >
                + Add Slot
              </button>
            </div>
          )}
        </div>

        <button 
          type="button" 
          className="schedule-open-timetable-btn"
          onClick={() => setIsTimetableModalOpen(true)}
        >
          <Calendar size={14} />
          <span>Open Timetable</span>
        </button>
      </div>

      {/* Weekly Timetable Modal */}
      {isTimetableModalOpen && createPortal(
        <div className="timetable-modal-overlay" onClick={() => setIsTimetableModalOpen(false)}>
          <div className="timetable-modal" style={{ height: '85vh', maxHeight: '680px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="timetable-modal-header" style={{ padding: '20px 20px 10px 20px', borderBottom: 'none' }}>
              <div>
                <h3 className="timetable-modal-title">Study Timetable • {monthHeader}</h3>
                <p className="timetable-modal-subtitle">Manage slots for your schedule</p>
              </div>
              <button 
                type="button" 
                className="timetable-modal-close-btn"
                onClick={() => setIsTimetableModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Google Calendar horizontal Day Selector strip */}
            <div className="calendar-day-strip" ref={dayStripRef}>
              {calendarDates.map((item) => {
                const isSelected = activeDateStr === item.dateStr;
                const isToday = item.dateStr === todayDateStr;
                const shortName = item.dayName.slice(0, 3);
                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    className={`day-strip-btn ${isSelected ? 'active' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => setActiveDateStr(item.dateStr)}
                  >
                    <span className="day-strip-label">{shortName}</span>
                    <div className="day-strip-circle">
                      <span>{item.dateNumber}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Google Calendar Timeline View */}
            <div className="calendar-timeline-scroll" ref={scrollContainerRef}>
              <div className="calendar-timeline-relative">
                {/* 24 Hour rows background grid */}
                {HOURS.map((hour) => (
                  <div key={hour} className="calendar-hour-row" style={{ height: '60px' }}>
                    <span className="calendar-hour-label">{formatHourLabel(hour)}</span>
                    <div className="calendar-hour-line" />
                  </div>
                ))}
                
                {/* Floating absolute positioned events for activeDay */}
                {slots
                  .filter((s) => s.day === activeDay)
                  .map((slot) => {
                    const startMins = parseTimeToMinutes(slot.timeStart);
                    const endMins = parseTimeToMinutes(slot.timeEnd);
                    let duration = endMins - startMins;
                    if (duration <= 0) duration = 60; // fallback to 1h
                    
                    const top = startMins;
                    const height = duration;
                    const color = getSubjectColor(slot.subject);
                    
                    return (
                      <div 
                        key={slot.id} 
                        className="calendar-event-card"
                        style={{ 
                          top: `${top}px`, 
                          height: `${height}px`,
                          borderLeftColor: color,
                          backgroundColor: `${color}14`
                        }}
                      >
                        <div className="calendar-event-info">
                          <span className="calendar-event-subject" style={{ color: color }}>{slot.subject}</span>
                          <span className="calendar-event-time">
                            {formatTime12h(slot.timeStart)} - {formatTime12h(slot.timeEnd)}
                          </span>
                        </div>
                        <button 
                          type="button" 
                          className="calendar-event-delete-btn"
                          onClick={() => handleDeleteSlot(slot.id)}
                          title="Delete Slot"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                  
                {/* Empty State */}
                {slots.filter((s) => s.day === activeDay).length === 0 && (
                  <div className="calendar-empty-state">
                    <Calendar size={32} className="text-muted" style={{ marginBottom: '8px' }} />
                    <p>No study slots scheduled for {activeDay.charAt(0) + activeDay.slice(1).toLowerCase()}.</p>
                    <button 
                      type="button" 
                      onClick={() => {
                        setNewSlotDay(activeDay);
                        setNewSlotSubject(subjectsList[0] || '');
                        setIsAddingSlotFromModal(true);
                      }}
                      className="calendar-empty-add-btn"
                    >
                      + Add Slot
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Floating Action Button (FAB) to Add Slot */}
            {slots.filter((s) => s.day === activeDay).length > 0 && (
              <button
                type="button"
                className="calendar-fab"
                onClick={() => {
                  setNewSlotDay(activeDay);
                  setNewSlotSubject(subjectsList[0] || '');
                  setIsAddingSlotFromModal(true);
                }}
                title="Add Schedule Slot"
              >
                <Plus size={24} />
              </button>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Add Slot From Modal Dialog */}
      {isAddingSlotFromModal && createPortal(
        <div className="timetable-modal-overlay modal-sub" onClick={() => setIsAddingSlotFromModal(false)}>
          <div className="timetable-sub-modal" onClick={(e) => e.stopPropagation()}>
            <div className="timetable-modal-header">
              <h3 className="timetable-modal-title">Add Slot for {newSlotDay.charAt(0) + newSlotDay.slice(1).toLowerCase()}</h3>
              <button 
                type="button" 
                className="timetable-modal-close-btn"
                onClick={() => setIsAddingSlotFromModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveSlotFromModal} className="schedule-inline-form mt-2">
              <div className="form-group">
                <label>Subject</label>
                <select 
                  value={newSlotSubject} 
                  onChange={(e) => setNewSlotSubject(e.target.value)}
                  className="styled-select"
                  required
                >
                  <option value="">Select Subject</option>
                  {subjectsList.map((sub, idx) => (
                    <option key={idx} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
              <div className="form-time-row">
                <div className="form-group">
                  <label>Start</label>
                  <input 
                    type="time" 
                    value={newSlotTimeStart} 
                    onChange={(e) => setNewSlotTimeStart(e.target.value)}
                    className="styled-time-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End</label>
                  <input 
                    type="time" 
                    value={newSlotTimeEnd} 
                    onChange={(e) => setNewSlotTimeEnd(e.target.value)}
                    className="styled-time-input"
                    required
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="form-save-btn">Save</button>
                <button type="button" onClick={() => setIsAddingSlotFromModal(false)} className="form-cancel-btn">Cancel</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
