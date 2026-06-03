import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Plus, Trash2, Target, Award, Calendar, Clock, Edit2, Check, BarChart2, Zap, Coffee, Maximize2, Minimize2 } from 'lucide-react';
import { SYLLABUS_DATA } from '../constants/syllabus';

export interface Task {
  id: number;
  text: string;
  completed: boolean;
  targetDate: string; // YYYY-MM-DD
}

interface PlannerProps {
  onAddStudyHours: (hours: number) => void;
  caLevel: string;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  todayHours: number;
  // Lifted timer props
  timerTimeLeft: number;
  timerRunning: boolean;
  timerType: 'focus' | 'break';
  timerPreset: '25' | '50' | '5';
  timerStatusText: string;
  onTimerSelectPreset: (preset: '25' | '50' | '5') => void;
  onTimerToggle: () => void;
  onTimerReset: () => void;
  formatTimerDisplay: (seconds: number) => string;
  timerStudyLabel: string;
  setTimerStudyLabel: (label: string) => void;
}

export const Planner: React.FC<PlannerProps> = ({
  onAddStudyHours, caLevel, tasks, setTasks, todayHours,
  timerTimeLeft, timerRunning, timerType: _timerType, timerPreset, timerStatusText,
  onTimerSelectPreset, onTimerToggle, onTimerReset, formatTimerDisplay,
  timerStudyLabel: _timerStudyLabel, setTimerStudyLabel,
}) => {
  const [plannerTab, setPlannerTab] = useState<'tasks' | 'timer'>('tasks');

  // --- Task State ---

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(getTodayDateString);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);



  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    if (editingTaskId !== null) {
      setTasks(prev => prev.map(t => t.id === editingTaskId ? { ...t, text: newTaskText, targetDate: newTaskDate } : t));
      setEditingTaskId(null);
      setNewTaskDate(getTodayDateString());
    } else {
      const newTask: Task = {
        id: Date.now(),
        text: newTaskText,
        completed: false,
        targetDate: newTaskDate
      };
      setTasks(prev => [...prev, newTask]);
    }
    setNewTaskText('');
  };

  const handleStartEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setNewTaskText(task.text);
    setNewTaskDate(task.targetDate);
  };

  const handleToggleTask = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleDeleteTask = (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (editingTaskId === id) {
      setEditingTaskId(null);
      setNewTaskText('');
      setNewTaskDate(getTodayDateString());
    }
  };

  // --- Statistics ---
  const pendingCount = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  // --- Focus Timer & Cycle States ---
  const [isTimerFullscreen, setIsTimerFullscreen] = useState(false);

  // Alias lifted timer props for shorter usage in JSX
  const selectedPreset = timerPreset;
  const timeLeft = timerTimeLeft;
  const formatTime = formatTimerDisplay;

  const [wakeTime, setWakeTime] = useState(() => localStorage.getItem('cand_wakeTime') || '');
  const [sleepTime, setSleepTime] = useState(() => localStorage.getItem('cand_sleepTime') || '');
  
  // Use the prop-based todayHours instead of local state
  const todayFocusHours = todayHours;

  // Update the study label whenever subject/chapter selection changes
  const updateStudyLabel = (subject: string, chapter: string) => {
    const label = subject ? (chapter ? `${subject} • ${chapter}` : subject) : '';
    setTimerStudyLabel(label);
  };

  useEffect(() => {
    localStorage.setItem('cand_wakeTime', wakeTime);
    localStorage.setItem('cand_sleepTime', sleepTime);
  }, [wakeTime, sleepTime]);



  const calculateSleepDuration = (sleep: string, wake: string): number => {
    if (!sleep || !wake) return 0;
    const [sleepH, sleepM] = sleep.split(':').map(Number);
    const [wakeH, wakeM] = wake.split(':').map(Number);
    let diffMins = (wakeH * 60 + wakeM) - (sleepH * 60 + sleepM);
    if (diffMins < 0) {
      diffMins += 24 * 60;
    }
    return parseFloat((diffMins / 60).toFixed(1));
  };

  const lastSleep = React.useMemo(() => {
    return calculateSleepDuration(sleepTime, wakeTime);
  }, [sleepTime, wakeTime]);

  const breakBalance = React.useMemo(() => {
    const balHours = Math.max(0, 24 - lastSleep - todayFocusHours);
    const hrs = Math.floor(balHours);
    const mins = Math.round((balHours - hrs) * 60);
    return { hrs, mins };
  }, [lastSleep, todayFocusHours]);

  // Dynamic syllabus-based manual logger states
  const currentSyllabus = (SYLLABUS_DATA[caLevel as keyof typeof SYLLABUS_DATA] || SYLLABUS_DATA.Intermediate) as Record<string, string[]>;
  const subjects = Object.keys(currentSyllabus);

  const [selectedSubject, setSelectedSubject] = useState(subjects[0] || '');
  const [selectedChapter, setSelectedChapter] = useState(() => {
    const initialSub = subjects[0] || '';
    const initialChaps = currentSyllabus[initialSub] || [];
    return initialChaps[0] || '';
  });
  const [selectedPhase, setSelectedPhase] = useState('Class');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [prevCaLevel, setPrevCaLevel] = useState(caLevel);

  const chapters = React.useMemo(() => {
    return currentSyllabus[selectedSubject] || [];
  }, [selectedSubject, currentSyllabus]);

  // Sync selected subject and chapter on caLevel change
  if (caLevel !== prevCaLevel) {
    setPrevCaLevel(caLevel);
    const initialSub = subjects[0] || '';
    setSelectedSubject(initialSub);
    const levelSyllabus = (SYLLABUS_DATA[caLevel as keyof typeof SYLLABUS_DATA] || SYLLABUS_DATA.Intermediate) as Record<string, string[]>;
    const initialChaps = levelSyllabus[initialSub] || [];
    setSelectedChapter(initialChaps[0] || '');
  }

  const handleSubjectChange = (subjectVal: string) => {
    setSelectedSubject(subjectVal);
    const chaps = currentSyllabus[subjectVal] || [];
    setSelectedChapter(chaps[0] || '');
  };

  const calculateDurationHours = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let diffMins = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffMins < 0) {
      diffMins += 24 * 60;
    }
    return parseFloat((diffMins / 60).toFixed(1));
  };

  const handleAddSessionBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) {
      alert('Please select a subject.');
      return;
    }
    if (!startTime || !endTime) {
      alert('Please enter start and end times.');
      return;
    }
    const hrs = calculateDurationHours(startTime, endTime);
    if (hrs <= 0) {
      alert('End time must be after start time.');
      return;
    }
    onAddStudyHours(hrs);
    alert(`Successfully logged ${hrs} hours of ${selectedSubject} (${selectedChapter || 'General'}) - ${selectedPhase}!`);
    setStartTime('');
    setEndTime('');
  };

  const groupedTasks = React.useMemo(() => {
    const groups: Record<string, Task[]> = {};
    tasks.forEach(t => {
      if (!groups[t.targetDate]) {
        groups[t.targetDate] = [];
      }
      groups[t.targetDate].push(t);
    });
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({
        date,
        list: groups[date]
      }));
  }, [tasks]);

  return (
    <div className="planner-container fade-in">
      {/* Tab Switcher */}
      <div className="planner-tabs">
        <button 
          type="button" 
          className={`planner-tab-btn ${plannerTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setPlannerTab('tasks')}
        >
          Daily Tasks
        </button>
        <button 
          type="button" 
          className={`planner-tab-btn ${plannerTab === 'timer' ? 'active' : ''}`}
          onClick={() => setPlannerTab('timer')}
        >
          Study Timer & Log
        </button>
      </div>

      {plannerTab === 'timer' ? (
        <div className="planner-timer-section">
          {/* Stats Row */}
          <div className="cycle-stats-row">
            <div className="cycle-stat-item">
              <div className="cycle-dot-label">
                <span className="cycle-dot purple"></span>
                <span className="cycle-label">FOCUS TIME</span>
              </div>
              <div className="cycle-val-row">
                <span className="cycle-val-num">{todayFocusHours.toFixed(1)}</span>
                <span className="cycle-val-unit">hrs</span>
              </div>
            </div>
            <div className="cycle-stat-item">
              <div className="cycle-dot-label">
                <span className="cycle-dot green"></span>
                <span className="cycle-label">LAST SLEEP</span>
              </div>
              <div className="cycle-val-row">
                <span className="cycle-val-num">{lastSleep}</span>
                <span className="cycle-val-unit">hrs</span>
              </div>
            </div>
            <div className="cycle-stat-item">
              <div className="cycle-dot-label">
                <span className="cycle-dot orange"></span>
                <span className="cycle-label">BREAK BAL.</span>
              </div>
              <div className="cycle-val-row">
                <span className="cycle-val-num">{breakBalance.hrs}</span>
                <span className="cycle-val-unit-h">h</span>
                <span className="cycle-val-num">{breakBalance.mins}</span>
                <span className="cycle-val-unit-m">m</span>
              </div>
            </div>
          </div>

          {/* Pomodoro Focus Timer */}
          <div className="timer-card">
            <div className="timer-card-header">
              <div>
                <span className="timer-deep-work-lbl">DEEP WORK</span>
                <h3 className="timer-card-title">Focus Session</h3>
              </div>
              <button 
                type="button" 
                className="timer-fullscreen-btn"
                onClick={() => setIsTimerFullscreen(true)}
                aria-label="Fullscreen"
              >
                <Maximize2 size={15} />
              </button>
            </div>

            {/* Studying selections inside card */}
            <div className="timer-studying-section">
              <span className="timer-studying-lbl">STUDYING</span>
              <div className="form-group mb-2">
                <select 
                  value={selectedSubject} 
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="timer-select select-subject"
                  required
                >
                  <option value="">— Select Target Subject —</option>
                  {subjects.map((sub, idx) => (
                    <option key={idx} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
              <div className="timer-form-row mb-3">
                <div className="input-group flex-1">
                  <select 
                    value={selectedChapter} 
                    onChange={(e) => setSelectedChapter(e.target.value)}
                    className="timer-select select-chapter"
                  >
                    <option value="">— Chapter —</option>
                    {chapters.map((chap, idx) => (
                      <option key={idx} value={chap}>{chap}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group flex-1">
                  <select 
                    value={selectedPhase} 
                    onChange={(e) => setSelectedPhase(e.target.value)}
                    className="timer-select select-phase"
                  >
                    <option value="Class">Class</option>
                    <option value="Revision 1">Revision 1</option>
                    <option value="Revision 2">Revision 2</option>
                    <option value="Revision 3">Revision 3</option>
                    <option value="Self Study">Self Study</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Presets Row */}
            <div className="timer-presets-row">
              <button 
                type="button" 
                className={`timer-preset-btn ${selectedPreset === '25' ? 'active' : ''}`}
                onClick={() => onTimerSelectPreset('25')}
              >
                <Clock size={12} />
                <span>25 min</span>
              </button>
              <button 
                type="button" 
                className={`timer-preset-btn ${selectedPreset === '50' ? 'active' : ''}`}
                onClick={() => onTimerSelectPreset('50')}
              >
                <Zap size={12} />
                <span>50 min</span>
              </button>
              <button 
                type="button" 
                className={`timer-preset-btn ${selectedPreset === '5' ? 'active' : ''}`}
                onClick={() => onTimerSelectPreset('5')}
              >
                <Coffee size={12} />
                <span>5 min</span>
              </button>
            </div>

            {/* Circular Timer Display */}
            <div className="timer-circle-wrap">
              <svg width="150" height="150" viewBox="0 0 100 100" className="timer-ring-svg">
                <defs>
                  <linearGradient id="timerGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="44" className="timer-ring-bg" />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  className="timer-ring-bar-gradient"
                  stroke="url(#timerGrad)"
                  style={{
                    strokeDasharray: 276.4,
                    strokeDashoffset: 276.4 - (276.4 * timeLeft) / (parseInt(selectedPreset, 10) * 60),
                  }}
                />
              </svg>
              <div className="timer-ring-center">
                <span className="timer-countdown">{formatTime(timeLeft)}</span>
                <span className="timer-status-text">{timerStatusText}</span>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="timer-bottom-controls">
              <button 
                type="button" 
                onClick={() => { updateStudyLabel(selectedSubject, selectedChapter); onTimerToggle(); }} 
                className={`timer-start-btn ${timerRunning ? 'running' : ''}`}
              >
                {timerRunning ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                <span>{timerRunning ? 'Pause Focus' : 'Start Focus'}</span>
              </button>
              <button type="button" onClick={onTimerReset} className="timer-reset-circular-btn" aria-label="Reset Timer">
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* 30 Days Trend Divider */}
          <div className="trend-divider-section">
            <div className="trend-header">
              <BarChart2 className="trend-icon" size={14} />
              <span className="trend-label">30 DAYS TREND</span>
            </div>
            <div className="dotted-line-divider"></div>
          </div>

          {/* Daily Cycle Settings */}
          <div className="cycle-settings-section">
            <span className="section-title-lbl">DAILY CYCLE SETTINGS</span>
            <div className="cycle-settings-card">
              <form onSubmit={(e) => { e.preventDefault(); alert("Daily Cycle data synced successfully!"); }} className="cycle-settings-form">
                <div className="cycle-form-row">
                  <div className="input-group">
                    <label>WAKE TIME</label>
                    <input 
                      type="time" 
                      value={wakeTime} 
                      onChange={(e) => setWakeTime(e.target.value)}
                      className="styled-time-input"
                    />
                  </div>
                  <div className="input-group">
                    <label>SLEEP TIME</label>
                    <input 
                      type="time" 
                      value={sleepTime} 
                      onChange={(e) => setSleepTime(e.target.value)}
                      className="styled-time-input"
                    />
                  </div>
                </div>
                <button type="submit" className="sync-cycle-btn">
                  Sync Cycle Data
                </button>
              </form>
            </div>
          </div>

          {/* Manual Log Addition */}
          <div className="manual-log-section">
            <span className="section-title-lbl">MANUAL LOG ADDITION</span>
            <div className="manual-log-card">
              <form onSubmit={handleAddSessionBlock} className="manual-log-form">
                <div className="input-group mb-3">
                  <label>SUBJECT</label>
                  <select 
                    value={selectedSubject} 
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="styled-select"
                    required
                  >
                    <option value="">— Select Target Subject —</option>
                    {subjects.map((sub, idx) => (
                      <option key={idx} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-row mb-3">
                  <div className="input-group flex-1">
                    <label>CHAPTER</label>
                    <select 
                      value={selectedChapter} 
                      onChange={(e) => setSelectedChapter(e.target.value)}
                      className="styled-select"
                    >
                      <option value="">— Chapter —</option>
                      {chapters.map((chap, idx) => (
                        <option key={idx} value={chap}>{chap}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group flex-1">
                    <label>STUDY PHASE</label>
                    <select 
                      value={selectedPhase} 
                      onChange={(e) => setSelectedPhase(e.target.value)}
                      className="styled-select"
                    >
                      <option value="Class">Class</option>
                      <option value="Revision 1">Revision 1</option>
                      <option value="Revision 2">Revision 2</option>
                      <option value="Revision 3">Revision 3</option>
                      <option value="Self Study">Self Study</option>
                    </select>
                  </div>
                </div>

                <div className="form-row mb-3">
                  <div className="input-group">
                    <label>START TIME</label>
                    <input 
                      type="time" 
                      value={startTime} 
                      onChange={(e) => setStartTime(e.target.value)}
                      className="styled-time-input"
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>END TIME</label>
                    <input 
                      type="time" 
                      value={endTime} 
                      onChange={(e) => setEndTime(e.target.value)}
                      className="styled-time-input"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="add-session-btn">
                  Add Session Block
                </button>
              </form>
            </div>
          </div>

          {/* Fullscreen Timer Overlay */}
          {isTimerFullscreen && (
            <div className="timer-fullscreen-overlay">
              <div className="fullscreen-header">
                <div>
                  <span className="timer-deep-work-lbl">DEEP WORK</span>
                  <h3 className="timer-card-title text-white">{selectedSubject || 'Focus Session'}</h3>
                  {selectedChapter && <p className="fullscreen-subtitle">{selectedChapter} • {selectedPhase}</p>}
                </div>
                <button 
                  type="button" 
                  className="timer-fullscreen-close-btn"
                  onClick={() => setIsTimerFullscreen(false)}
                >
                  <Minimize2 size={24} />
                </button>
              </div>
              <div className="fullscreen-content">
                {/* Landscape Flip Clock */}
                <div className="timer-flip-clock-wrap">
                  <div className="flip-clock-container">
                    <div className="flip-card-wrapper" key={`min-${Math.floor(timeLeft / 60)}`}>
                      <div className="flip-card">
                        <span className="flip-card-num">{Math.floor(timeLeft / 60).toString().padStart(2, '0')}</span>
                        <div className="flip-card-divider"></div>
                      </div>
                      <span className="flip-card-label">MINUTES</span>
                    </div>
                    
                    <div className="flip-clock-colon">:</div>

                    <div className="flip-card-wrapper" key={`sec-${timeLeft % 60}`}>
                      <div className="flip-card">
                        <span className="flip-card-num">{(timeLeft % 60).toString().padStart(2, '0')}</span>
                        <div className="flip-card-divider"></div>
                      </div>
                      <span className="flip-card-label">SECONDS</span>
                    </div>
                  </div>
                  <span className="flip-clock-status">{timerStatusText}</span>
                </div>
                <div className="timer-bottom-controls fullscreen">
                  <button 
                    type="button" 
                    onClick={() => { updateStudyLabel(selectedSubject, selectedChapter); onTimerToggle(); }} 
                    className={`timer-start-btn fullscreen ${timerRunning ? 'running' : ''}`}
                  >
                    {timerRunning ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
                    <span>{timerRunning ? 'Pause Focus' : 'Start Focus'}</span>
                  </button>
                  <button type="button" onClick={onTimerReset} className="timer-reset-circular-btn fullscreen" aria-label="Reset Timer">
                    <RotateCcw size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="planner-tasks-section">
          {/* Header Stats Bar */}
          <div className="task-stats-bar">
            <div className="task-stat-card focus">
              <div className="task-stat-icon-wrapper focus">
                <Target size={20} />
              </div>
              <div className="task-stat-details">
                <span className="task-stat-label">TODAY'S FOCUS</span>
                <span className="task-stat-value">{pendingCount} Pending</span>
              </div>
            </div>
            <div className="task-stat-card wins">
              <div className="task-stat-icon-wrapper wins">
                <Award size={20} />
              </div>
              <div className="task-stat-details">
                <span className="task-stat-label">WINS LOGGED</span>
                <span className="task-stat-value">{completedCount} Completed</span>
              </div>
            </div>
            <div className="task-stat-card scope">
              <div className="task-stat-icon-wrapper scope">
                <Calendar size={20} />
              </div>
              <div className="task-stat-details">
                <span className="task-stat-label">TOTAL SCOPE</span>
                <span className="task-stat-value">{totalCount} Goals</span>
              </div>
            </div>
          </div>


              {/* Task Creator Card */}
              <div className="task-creator-card">
                <form onSubmit={handleAddTask} className="task-creator-form">
                  <div className="form-group">
                    <label className="form-group-label">NEW OBJECTIVE</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Solve FR Consolidation Sums..."
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      className="task-input-field"
                      required
                    />
                  </div>
                  <div className="form-row-creator">
                    <div className="form-group">
                      <label className="form-group-label">TARGET DATE</label>
                      <input 
                        type="date" 
                        value={newTaskDate}
                        onChange={(e) => setNewTaskDate(e.target.value)}
                        className="task-date-field"
                        required
                      />
                    </div>
                    <div className="creator-actions">
                      <button type="submit" className="task-log-btn">
                        <Plus size={15} />
                        <span>{editingTaskId !== null ? 'Update' : 'Log Task'}</span>
                      </button>
                      {editingTaskId !== null && (
                        <button 
                          type="button" 
                          onClick={() => {
                            setEditingTaskId(null);
                            setNewTaskText('');
                            setNewTaskDate(getTodayDateString());
                          }} 
                          className="task-cancel-edit-btn"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>

              {/* Grouped Task List */}
              <div className="task-groups-list">
                {groupedTasks.length === 0 ? (
                  <div className="task-list-empty">
                    <Calendar size={36} className="text-muted" style={{ marginBottom: '8px' }} />
                    <p>No study tasks scheduled yet.</p>
                  </div>
                ) : (
                  groupedTasks.map(group => (
                    <div key={group.date} className="task-group">
                      <div className="task-group-header">
                        <span className="task-group-dot" />
                        <span className="task-group-date">{group.date}</span>
                      </div>
                      <div className="task-group-items">
                        {group.list.map(task => (
                          <div key={task.id} className={`task-list-item-card ${task.completed ? 'completed' : ''}`}>
                            <button 
                              type="button" 
                              onClick={() => handleToggleTask(task.id)}
                              className="task-item-checkbox-btn"
                              aria-label="Toggle Complete"
                            >
                              {task.completed ? (
                                <div className="task-checked-dot">
                                  <Check size={10} strokeWidth={4} />
                                </div>
                              ) : (
                                <div className="task-unchecked-outline" />
                              )}
                            </button>
                            <div className="task-item-info">
                              <span className="task-item-text">{task.text}</span>
                              <span className="task-item-scheduled">
                                <Clock size={11} style={{ marginRight: '4px' }} />
                                Scheduled for {task.targetDate}
                              </span>
                            </div>
                            <div className="task-item-actions">
                              <button 
                                type="button" 
                                onClick={() => handleStartEditTask(task)}
                                className="task-edit-btn"
                                aria-label="Edit Task"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handleDeleteTask(task.id)}
                                className="task-delete-btn-red"
                                aria-label="Delete Task"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

        </div>
      )}
    </div>
  );
};
