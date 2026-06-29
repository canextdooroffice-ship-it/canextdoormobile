import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, RotateCcw, Plus, Trash2, Target, Award, Calendar, Clock, Edit2, Check, BarChart2, Zap, Coffee, Maximize2, Minimize2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { SYLLABUS_DATA } from '../constants/syllabus';
import type { ProgressState } from './Subjects';
import { CustomSelect } from './CustomSelect';

export interface Task {
  id: number;
  text: string;
  completed: boolean;
  targetDate: string; // YYYY-MM-DD
}

export interface StudyLog {
  id: string;
  date: string;
  hours: number;
  label: string;
  timestamp: string;
}

interface PlannerProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onAddStudyHours: (hours: number, label?: string) => void;
  caLevel: string;
  progressState: ProgressState;
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
  studyTarget: number;
  setStudyTarget: (target: number) => void;
  studyHistory: Record<string, number>;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  wakeTime: string;
  setWakeTime: (time: string) => void;
  sleepTime: string;
  setSleepTime: (time: string) => void;
  sleepHistory: Record<string, string>;
  isTimerFullscreen: boolean;
  setIsTimerFullscreen: (fullscreen: boolean) => void;
  isChartFullscreen: boolean;
  setIsChartFullscreen: (fullscreen: boolean) => void;
  studyLogs: StudyLog[];
  onDeleteStudyLog: (logId: string) => void;
  onResetDailyTotal: (date: string) => void;
  hiddenSubjects?: string[];
}

interface BarChartProps {
  data: { dateLabel: string; hours: number }[];
  target: number;
}

const TrendBarChart: React.FC<BarChartProps> = ({ data, target }) => {
  const [hoveredBar, setHoveredBar] = React.useState<{ x: number; y: number; date: string; hours: number } | null>(null);

  const width = 360;
  const height = 110;
  const paddingTop = 15;
  const paddingBottom = 20;
  const paddingLeft = 16;
  const paddingRight = 16;

  const numericTarget = Number(target) || 0;
  const maxHours = Math.max(8, numericTarget, ...data.map(d => d.hours));

  const slotWidth = (width - paddingLeft - paddingRight) / data.length;
  const barWidth = 6;

  // Y coordinate for target line
  const targetY = height - paddingBottom - (numericTarget / maxHours) * (height - paddingTop - paddingBottom);

  return (
    <div className="trend-chart-wrapper" style={{ position: 'relative', width: '100%', marginTop: '8px' }}>
      <style>{`
        .trend-bar-rect {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .trend-bar-rect:hover {
          filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.8));
        }
      `}</style>
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        width="100%" 
        height={height}
        style={{ overflow: 'visible' }}
        onMouseLeave={() => setHoveredBar(null)}
        onTouchEnd={() => setHoveredBar(null)}
      >
        <defs>
          <linearGradient id="trend-bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="trend-bar-grad-hover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Subtle Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((ratio, idx) => {
          const y = height - paddingBottom - ratio * (height - paddingTop - paddingBottom);
          return (
            <line
              key={idx}
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="var(--border-color)"
              strokeWidth="0.5"
              strokeDasharray="3,6"
              opacity="0.3"
            />
          );
        })}

        {/* Base line */}
        <line 
          x1={paddingLeft} 
          y1={height - paddingBottom} 
          x2={width - paddingRight} 
          y2={height - paddingBottom} 
          stroke="var(--border-color)" 
          strokeWidth="1.5" 
          opacity="0.8"
        />

        {/* Target dashed line */}
        {targetY >= paddingTop && targetY <= height - paddingBottom && (
          <g>
            <line 
              x1={paddingLeft} 
              y1={targetY} 
              x2={width - paddingRight} 
              y2={targetY} 
              stroke="#06b6d4" 
              strokeWidth="1.5" 
              strokeDasharray="4,4" 
              opacity="0.85"
            />
            {/* Glowing line overlay */}
            <line 
              x1={paddingLeft} 
              y1={targetY} 
              x2={width - paddingRight} 
              y2={targetY} 
              stroke="#06b6d4" 
              strokeWidth="1" 
              opacity="0.4"
              filter="url(#glow)"
            />
            <text 
              x={width - paddingRight - 4} 
              y={targetY - 4} 
              fill="#22d3ee" 
              fontSize="7.5" 
              fontWeight="800" 
              textAnchor="end"
              opacity="0.9"
            >
              TARGET ({target}h)
            </text>
          </g>
        )}

        {/* Render Bars */}
        {data.map((pt, idx) => {
          const x = paddingLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
          const barHeight = (pt.hours / maxHours) * (height - paddingTop - paddingBottom);
          const y = height - paddingBottom - barHeight;
          const isHovered = hoveredBar?.date === pt.dateLabel;

          return (
            <rect
              key={idx}
              className="trend-bar-rect"
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(1.5, barHeight)}
              rx="2"
              ry="2"
              fill={isHovered ? "url(#trend-bar-grad-hover)" : "url(#trend-bar-grad)"}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredBar({
                  x: x + barWidth / 2,
                  y: y,
                  date: pt.dateLabel,
                  hours: pt.hours
                });
              }}
              onTouchStart={() => {
                setHoveredBar({
                  x: x + barWidth / 2,
                  y: y,
                  date: pt.dateLabel,
                  hours: pt.hours
                });
              }}
            />
          );
        })}

        {/* Axis Labels */}
        <text 
          x={paddingLeft} 
          y={height - 4} 
          fill="var(--text-muted)" 
          fontSize="8" 
          fontWeight="700"
        >
          {data[0]?.dateLabel}
        </text>
        <text 
          x={width - paddingRight} 
          y={height - 4} 
          fill="var(--text-muted)" 
          fontSize="8" 
          fontWeight="700" 
          textAnchor="end"
        >
          Today
        </text>
      </svg>

      {/* Tooltip Overlay */}
      {hoveredBar && (
        <div 
          className="trend-tooltip"
          style={{
            position: 'absolute',
            left: `${(hoveredBar.x / width) * 100}%`,
            top: `${(hoveredBar.y / height) * 100 - 8}%`,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1.5px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '10px',
            padding: '6px 10px',
            fontSize: '10px',
            fontWeight: 700,
            color: '#ffffff',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.25)',
            zIndex: 10,
          }}
        >
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '8px', fontWeight: 600, marginBottom: '2px' }}>{hoveredBar.date}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22d3ee' }}></span>
            <span>{hoveredBar.hours} hrs focus</span>
          </div>
        </div>
      )}
    </div>
  );
};

const FullscreenBarChart: React.FC<BarChartProps> = ({ data, target }) => {
  const [hoveredBar, setHoveredBar] = React.useState<{ x: number; y: number; date: string; hours: number } | null>(null);

  const width = 360;
  const height = 320;
  const paddingTop = 30;
  const paddingBottom = 40;
  const paddingLeft = 32;
  const paddingRight = 16;

  const numericTarget = Number(target) || 0;
  const maxHours = Math.max(8, numericTarget, ...data.map(d => d.hours));
  const maxAxisHours = Math.ceil(maxHours / 2) * 2;

  const slotWidth = (width - paddingLeft - paddingRight) / data.length;
  const barWidth = data.length === 7 ? 16 : data.length === 15 ? 10 : 6;
  const rx = data.length === 7 ? 4 : data.length === 15 ? 3 : 2;

  // Y coordinate for target line
  const targetY = height - paddingBottom - (numericTarget / maxAxisHours) * (height - paddingTop - paddingBottom);

  // Generate 5 Y-axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxAxisHours * i) / 4);

  return (
    <div className="fullscreen-chart-wrapper" style={{ position: 'relative', width: '100%', maxWidth: '360px', height: '100%', maxHeight: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <style>{`
        .fs-bar-rect {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .fs-bar-rect:hover {
          filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.8));
        }
      `}</style>
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        width="100%" 
        height="100%"
        style={{ overflow: 'visible' }}
        onMouseLeave={() => setHoveredBar(null)}
        onTouchEnd={() => setHoveredBar(null)}
      >
        <defs>
          <linearGradient id="fs-bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="fs-bar-grad-hover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
          </linearGradient>
          <filter id="glow-fs" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal grid lines and Y-axis labels */}
        {yTicks.map((val, idx) => {
          const y = height - paddingBottom - (val / maxAxisHours) * (height - paddingTop - paddingBottom);
          return (
            <g key={idx} opacity="0.85">
              <line 
                x1={paddingLeft} 
                y1={y} 
                x2={width - paddingRight} 
                y2={y} 
                stroke="var(--border-color)" 
                strokeWidth="0.75" 
                strokeDasharray={val === 0 ? "none" : "3,6"}
                opacity={val === 0 ? "0.8" : "0.3"}
              />
              <text 
                x={paddingLeft - 8} 
                y={y + 3} 
                fill="var(--text-muted)" 
                fontSize="8.5" 
                fontWeight="700" 
                textAnchor="end"
              >
                {val.toFixed(0)}h
              </text>
            </g>
          );
        })}

        {/* Target line */}
        {targetY >= paddingTop && targetY <= height - paddingBottom && (
          <g>
            <line 
              x1={paddingLeft} 
              y1={targetY} 
              x2={width - paddingRight} 
              y2={targetY} 
              stroke="#06b6d4" 
              strokeWidth="1.5" 
              strokeDasharray="4,4" 
              opacity="0.85"
            />
            {/* Glowing line overlay */}
            <line 
              x1={paddingLeft} 
              y1={targetY} 
              x2={width - paddingRight} 
              y2={targetY} 
              stroke="#06b6d4" 
              strokeWidth="1" 
              opacity="0.4"
              filter="url(#glow-fs)"
            />
            <text 
              x={width - paddingRight - 6} 
              y={targetY - 5} 
              fill="#22d3ee" 
              fontSize="8" 
              fontWeight="800" 
              textAnchor="end"
            >
              TARGET ({target}h)
            </text>
          </g>
        )}

        {/* Render Bars */}
        {data.map((pt, idx) => {
          const x = paddingLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
          const barHeight = (pt.hours / maxAxisHours) * (height - paddingTop - paddingBottom);
          const y = height - paddingBottom - barHeight;
          const isHovered = hoveredBar?.date === pt.dateLabel;

          return (
            <rect
              key={idx}
              className="fs-bar-rect"
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(1.5, barHeight)}
              rx={rx}
              ry={rx}
              fill={isHovered ? "url(#fs-bar-grad-hover)" : "url(#fs-bar-grad)"}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredBar({
                  x: x + barWidth / 2,
                  y: y,
                  date: pt.dateLabel,
                  hours: pt.hours
                });
              }}
              onTouchStart={() => {
                setHoveredBar({
                  x: x + barWidth / 2,
                  y: y,
                  date: pt.dateLabel,
                  hours: pt.hours
                });
              }}
            />
          );
        })}

        {/* X-axis labels (every 5 days, plus start & end) */}
        {data.map((pt, idx) => {
          const showLabel = idx === 0 || idx === data.length - 1 || idx % 5 === 0;
          if (!showLabel) return null;

          const x = paddingLeft + idx * slotWidth + slotWidth / 2;
          const labelText = idx === data.length - 1 ? "Today" : pt.dateLabel;

          return (
            <text 
              key={idx}
              x={x} 
              y={height - paddingBottom + 16} 
              fill="var(--text-muted)" 
              fontSize="8" 
              fontWeight="700" 
              textAnchor="middle"
            >
              {labelText}
            </text>
          );
        })}
      </svg>

      {/* Tooltip Overlay */}
      {hoveredBar && (
        <div 
          className="trend-tooltip"
          style={{
            position: 'absolute',
            left: `${(hoveredBar.x / width) * 100}%`,
            top: `${(hoveredBar.y / height) * 100 - 8}%`,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1.5px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '10px',
            padding: '6px 10px',
            fontSize: '10px',
            fontWeight: 700,
            color: '#ffffff',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.25)',
            zIndex: 10,
          }}
        >
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '8px', fontWeight: 600, marginBottom: '2px' }}>{hoveredBar.date}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22d3ee' }}></span>
            <span>{hoveredBar.hours} hrs focus</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const Planner: React.FC<PlannerProps> = ({
  showToast,
  onAddStudyHours, caLevel, progressState, tasks, setTasks, todayHours,
  timerTimeLeft, timerRunning, timerType: _timerType, timerPreset, timerStatusText,
  onTimerSelectPreset, onTimerToggle, onTimerReset, formatTimerDisplay,
  timerStudyLabel: _timerStudyLabel, setTimerStudyLabel,
  studyTarget,
  setStudyTarget,
  studyHistory,
  selectedDate,
  setSelectedDate,
  wakeTime,
  setWakeTime,
  sleepTime,
  setSleepTime,
  sleepHistory,
  isTimerFullscreen,
  setIsTimerFullscreen,
  isChartFullscreen,
  setIsChartFullscreen,
  studyLogs,
  onDeleteStudyLog,
  onResetDailyTotal,
  hiddenSubjects = [],
}) => {
  const [plannerTab, setPlannerTab] = useState<'tasks' | 'timer'>('tasks');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isTrendCollapsed, setIsTrendCollapsed] = useState(false);
  const [chartRange, setChartRange] = useState<7 | 15 | 30>(30);
  const [chartMode, setChartMode] = useState<'days' | 'month'>('days');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  });

  const [localTarget, setLocalTarget] = useState(studyTarget.toString());
  useEffect(() => {
    if (parseFloat(localTarget) !== studyTarget) {
      setLocalTarget(studyTarget.toString());
    }
  }, [studyTarget]);

  // Generate 30 days trend data from studyHistory
  const trendData = React.useMemo(() => {
    const dataList: { dateLabel: string; hours: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      const hours = studyHistory[dateStr] ?? 0;
      dataList.push({ dateLabel, hours });
    }
    return dataList;
  }, [studyHistory]);



  const getDaysInMonthData = (yearMonthStr: string, history: Record<string, number>) => {
    const [year, month] = yearMonthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dataList: { dateLabel: string; hours: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      const d = new Date(year, month - 1, day);
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      const hours = history[dateStr] ?? 0;
      dataList.push({ dateLabel, hours });
    }
    return dataList;
  };

  const fullscreenTrendData = React.useMemo(() => {
    if (chartMode === 'days') {
      return trendData.slice(-chartRange);
    }
    return getDaysInMonthData(selectedMonth, studyHistory);
  }, [trendData, chartMode, selectedMonth, chartRange, studyHistory]);

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

  // Alias lifted timer props for shorter usage in JSX
  const selectedPreset = timerPreset;
  const timeLeft = timerTimeLeft;
  const formatTime = formatTimerDisplay;

  // Fetch focus hours for selected date (use active todayHours for today, studyHistory for past)
  const focusHoursForSelectedDate = selectedDate === getTodayDateString() ? todayHours : (studyHistory[selectedDate] ?? 0);
  const todayFocusHours = focusHoursForSelectedDate;

  // Update the study label whenever subject/chapter selection changes
  const updateStudyLabel = (subject: string, chapter: string, phase: string) => {
    const label = subject ? `${subject} - ${chapter || 'General'} (${phase})` : '';
    setTimerStudyLabel(label);
  };



  const calculateSleepDuration = (sleep: string, wake: string): number => {
    if (!sleep || !wake || sleep === 'null' || wake === 'null' || sleep === 'undefined' || wake === 'undefined') return 0;
    const partsSleep = sleep.split(':');
    const partsWake = wake.split(':');
    if (partsSleep.length < 2 || partsWake.length < 2) return 0;
    const sleepH = Number(partsSleep[0]);
    const sleepM = Number(partsSleep[1]);
    const wakeH = Number(partsWake[0]);
    const wakeM = Number(partsWake[1]);
    if (isNaN(sleepH) || isNaN(sleepM) || isNaN(wakeH) || isNaN(wakeM)) return 0;
    let diffMins = (wakeH * 60 + wakeM) - (sleepH * 60 + sleepM);
    if (diffMins < 0) {
      diffMins += 24 * 60;
    }
    return parseFloat((diffMins / 60).toFixed(1));
  };

  const getYesterdayDateString = (dateStr: string): string => {
    const [yyyy, mm, dd] = dateStr.split('-').map(Number);
    const date = new Date(yyyy, mm - 1, dd);
    date.setDate(date.getDate() - 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const lastSleep = React.useMemo(() => {
    const yesterdayDate = getYesterdayDateString(selectedDate);
    const yesterdaySleep = sleepHistory[yesterdayDate];
    const sleepValSrc = yesterdaySleep || sleepTime;
    const sleepVal = calculateSleepDuration(sleepValSrc, wakeTime);
    return isNaN(sleepVal) ? 0 : sleepVal;
  }, [selectedDate, sleepHistory, sleepTime, wakeTime]);

  const breakBalance = React.useMemo(() => {
    const sleepVal = Number(lastSleep) || 0;
    const focusVal = Number(todayFocusHours) || 0;
    const balHours = Math.max(0, 24 - sleepVal - focusVal);
    const hrs = Math.floor(balHours);
    const mins = Math.round((balHours - hrs) * 60);
    return {
      hrs: isNaN(hrs) ? 0 : hrs,
      mins: isNaN(mins) ? 0 : mins
    };
  }, [lastSleep, todayFocusHours]);

  // Dynamic syllabus-based manual logger states
  const currentSyllabus = (SYLLABUS_DATA[caLevel as keyof typeof SYLLABUS_DATA] || SYLLABUS_DATA.Intermediate) as Record<string, string[]>;

  // Get all subjects active for the current level (excluding deleted ones, including custom ones)
  const getAllSubjects = () => {
    const defaultSubs = Object.keys(currentSyllabus);
    return Object.keys(progressState).filter((sub) => {
      if (hiddenSubjects.includes(sub)) {
        return false;
      }
      const isDefaultCurrent = defaultSubs.includes(sub);
      const isDefaultAny = Object.values(SYLLABUS_DATA).some((levelSyllabus) =>
        Object.keys(levelSyllabus).includes(sub)
      );
      const isCustom = !isDefaultAny;
      return isDefaultCurrent || isCustom;
    });
  };

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

  const subjects = getAllSubjects();

  const [selectedSubject, setSelectedSubject] = useState(subjects[0] || '');
  const [selectedChapter, setSelectedChapter] = useState(() => {
    const initialSub = subjects[0] || '';
    const initialChaps = getSubjectChapters(initialSub);
    return initialChaps[0] || '';
  });
  const [selectedPhase, setSelectedPhase] = useState('Class');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [prevCaLevel, setPrevCaLevel] = useState(caLevel);

  const chapters = React.useMemo(() => {
    return getSubjectChapters(selectedSubject);
  }, [selectedSubject, progressState, currentSyllabus]);

  // Sync selected subject and chapter on caLevel change
  if (caLevel !== prevCaLevel) {
    setPrevCaLevel(caLevel);
    const initialSub = subjects[0] || '';
    setSelectedSubject(initialSub);
    const initialChaps = getSubjectChapters(initialSub);
    setSelectedChapter(initialChaps[0] || '');
  }

  // Handle deletions in progressState
  useEffect(() => {
    const activeSubs = getAllSubjects();
    if (activeSubs.length > 0 && !activeSubs.includes(selectedSubject)) {
      setSelectedSubject(activeSubs[0]);
      const chaps = getSubjectChapters(activeSubs[0]);
      setSelectedChapter(chaps[0] || '');
    }
  }, [progressState]);

  const handleSubjectChange = (subjectVal: string) => {
    setSelectedSubject(subjectVal);
    const chaps = getSubjectChapters(subjectVal);
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
      showToast('Please select a subject.', 'error');
      return;
    }
    if (!startTime || !endTime) {
      showToast('Please enter start and end times.', 'error');
      return;
    }
    const hrs = calculateDurationHours(startTime, endTime);
    if (hrs <= 0) {
      showToast('End time must be after start time.', 'error');
      return;
    }
    const label = `${selectedSubject} - ${selectedChapter || 'General'} (${selectedPhase})`;
    onAddStudyHours(hrs, label);
    showToast(`Successfully logged ${hrs} hours of ${selectedSubject} (${selectedChapter || 'General'}) - ${selectedPhase}!`, 'success');
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
          {/* Date Filter */}
          <div className="date-filter-container" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '16px', 
            background: '#0b1528', 
            padding: '10px 16px', 
            borderRadius: '16px', 
            border: '1.5px solid #1e293b' 
          }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>VIEW DATE STATS</span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || getTodayDateString())}
              style={{
                background: '#0f172a',
                border: '1.5px solid #1e293b',
                color: '#ffffff',
                borderRadius: '9999px',
                padding: '5px 14px',
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                fontWeight: '700',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Stats Row */}
          <div className="cycle-stats-row">
            <div 
              className="cycle-stat-item focus-time-clickable" 
              onClick={() => setIsLogModalOpen(true)}
              title="Click to view focus logs"
            >
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
                <CustomSelect
                  value={selectedSubject}
                  onChange={handleSubjectChange}
                  options={subjects}
                  placeholder="— Select Target Subject —"
                  className="timer-select select-subject"
                />
              </div>
              <div className="timer-form-row mb-3">
                <div className="input-group flex-1">
                  <CustomSelect
                    value={selectedChapter}
                    onChange={setSelectedChapter}
                    options={chapters}
                    placeholder="— Chapter —"
                    className="timer-select select-chapter"
                  />
                </div>
                <div className="input-group flex-1">
                  <CustomSelect
                    value={selectedPhase}
                    onChange={setSelectedPhase}
                    options={['Class', 'Revision 1', 'Revision 2', 'Revision 3', 'Self Study']}
                    className="timer-select select-phase"
                  />
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
                onClick={() => { updateStudyLabel(selectedSubject, selectedChapter, selectedPhase); onTimerToggle(); }} 
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
            <div className="trend-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart2 className="trend-icon" size={14} />
                  <span className="trend-label">30 DAYS TREND</span>
                </div>
                {/* Target Hours Edit inline */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  padding: '3px 8px', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(255, 255, 255, 0.08)' 
                }}>
                  <Target size={10} style={{ color: 'var(--accent-cyan)' }} />
                  <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)' }}>Target:</span>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    value={localTarget}
                    onChange={(e) => {
                      setLocalTarget(e.target.value);
                      const parsed = parseFloat(e.target.value);
                      if (!isNaN(parsed) && parsed > 0) {
                        setStudyTarget(parsed);
                      }
                    }}
                    onBlur={() => {
                      if (localTarget === '' || isNaN(parseFloat(localTarget))) {
                        setLocalTarget(studyTarget.toString());
                      }
                    }}
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      color: 'var(--accent-cyan)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      width: '36px',
                      textAlign: 'center',
                      padding: '1px 2px',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)' }}>h</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Collapse Button */}
                <button
                  type="button"
                  onClick={() => setIsTrendCollapsed(!isTrendCollapsed)}
                  aria-label={isTrendCollapsed ? "Expand Chart" : "Collapse Chart"}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#94a3b8',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; e.currentTarget.style.color = '#ffffff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  {isTrendCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                </button>
                {/* Expand Button */}
                <button 
                  type="button" 
                  className="trend-fullscreen-btn"
                  onClick={() => setIsChartFullscreen(true)}
                  aria-label="Fullscreen Chart"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#94a3b8',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; e.currentTarget.style.color = '#ffffff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
            {!isTrendCollapsed && <TrendBarChart data={trendData} target={studyTarget} />}
          </div>

          {/* Daily Cycle Settings */}
          <div className="cycle-settings-section">
            <span className="section-title-lbl">DAILY CYCLE SETTINGS</span>
            <div className="cycle-settings-card">
              <form onSubmit={(e) => { e.preventDefault(); showToast("Daily Cycle data synced successfully!", "success"); }} className="cycle-settings-form">
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
                  <div className="input-group">
                    <label>DAILY TARGET (HRS)</label>
                    <input 
                      type="number" 
                      min="1"
                      max="24"
                      step="0.5"
                      value={localTarget}
                      onChange={(e) => {
                        setLocalTarget(e.target.value);
                        const parsed = parseFloat(e.target.value);
                        if (!isNaN(parsed) && parsed > 0) {
                          setStudyTarget(parsed);
                        }
                      }}
                      onBlur={() => {
                        if (localTarget === '' || isNaN(parseFloat(localTarget))) {
                          setLocalTarget(studyTarget.toString());
                        }
                      }}
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
                  <CustomSelect
                    value={selectedSubject}
                    onChange={handleSubjectChange}
                    options={subjects}
                    placeholder="— Select Target Subject —"
                  />
                </div>
                
                <div className="form-row mb-3">
                  <div className="input-group flex-1">
                    <label>CHAPTER</label>
                    <CustomSelect
                      value={selectedChapter}
                      onChange={setSelectedChapter}
                      options={chapters}
                      placeholder="— Chapter —"
                    />
                  </div>
                  <div className="input-group flex-1">
                    <label>STUDY PHASE</label>
                    <CustomSelect
                      value={selectedPhase}
                      onChange={setSelectedPhase}
                      options={['Class', 'Revision 1', 'Revision 2', 'Revision 3', 'Self Study']}
                    />
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
                    onClick={() => { updateStudyLabel(selectedSubject, selectedChapter, selectedPhase); onTimerToggle(); }} 
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

          {/* Fullscreen Chart Overlay */}
          {isChartFullscreen && (
            <div className="chart-fullscreen-overlay">
              <div className="fullscreen-header">
                <div>
                  <span className="timer-deep-work-lbl">ANALYTICS</span>
                  <h3 className="timer-card-title text-white">
                    {chartMode === 'days' 
                      ? `${chartRange} Days` 
                      : new Date(selectedMonth + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    } Study Trend
                  </h3>
                </div>
                <button 
                  type="button" 
                  className="timer-fullscreen-close-btn"
                  onClick={() => setIsChartFullscreen(false)}
                >
                  <Minimize2 size={24} />
                </button>
              </div>
              <div className="fullscreen-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', paddingBottom: '30px' }}>
                <FullscreenBarChart data={fullscreenTrendData} target={studyTarget} />
                
                {/* Mode Toggles */}
                <div style={{
                  display: 'flex',
                  background: '#0b1528',
                  borderRadius: '9999px',
                  border: '1.5px solid #1e293b',
                  padding: '4px',
                  gap: '4px',
                  marginTop: '24px',
                  marginBottom: '12px'
                }}>
                  <button
                    type="button"
                    onClick={() => setChartMode('days')}
                    style={{
                      background: chartMode === 'days' ? 'var(--accent-primary)' : 'transparent',
                      color: chartMode === 'days' ? '#ffffff' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '6px 14px',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Days View
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('month')}
                    style={{
                      background: chartMode === 'month' ? 'var(--accent-primary)' : 'transparent',
                      color: chartMode === 'month' ? '#ffffff' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '6px 14px',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Month Calendar
                  </button>
                </div>

                {/* Sub-selectors */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40px', width: '100%', maxWidth: '320px' }}>
                  {chartMode === 'days' ? (
                    <div style={{
                      display: 'flex',
                      background: '#0f172a',
                      borderRadius: '12px',
                      border: '1.5px solid #1e293b',
                      padding: '2px'
                    }}>
                      {[7, 15, 30].map((range) => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => setChartRange(range as 7 | 15 | 30)}
                          style={{
                            background: chartRange === range ? 'var(--accent-primary)' : 'transparent',
                            color: chartRange === range ? '#ffffff' : 'var(--text-muted)',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '6px 12px',
                            fontSize: '11px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {range} Days
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>SELECT MONTH:</span>
                      <input 
                        type="month" 
                        value={selectedMonth} 
                        onChange={(e) => {
                          if (e.target.value) {
                            setSelectedMonth(e.target.value);
                          }
                        }}
                        style={{
                          background: '#0f172a',
                          border: '1.5px solid #1e293b',
                          color: '#ffffff',
                          borderRadius: '12px',
                          padding: '6px 12px',
                          fontFamily: 'var(--font-body)',
                          fontSize: '12px',
                          fontWeight: '800',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  )}
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

      {/* FOCUS TIME LOGS MODAL */}
      {isLogModalOpen && createPortal(
        <div className="matrix-modal-overlay" onClick={() => setIsLogModalOpen(false)}>
          <div className="matrix-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="matrix-modal-header">
              <div>
                <h4 className="matrix-modal-title">Focus Time Logs</h4>
                <p className="matrix-modal-subtitle">
                  Study logs for <span className="text-purple-badge">{selectedDate}</span>
                </p>
              </div>
              <button 
                type="button" 
                className="matrix-modal-close-btn" 
                onClick={() => setIsLogModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {(() => {
              const dayLogs = studyLogs.filter((l) => l.date === selectedDate);
              const hasLogs = dayLogs.length > 0;
              const hasHoursRecorded = todayFocusHours > 0;

              if (hasLogs) {
                return (
                  <div className="study-logs-list">
                    {dayLogs.map((log) => (
                      <div key={log.id} className="study-log-item">
                        <div className="study-log-info">
                          <div className="study-log-label">{log.label}</div>
                          <div className="study-log-time">{log.timestamp}</div>
                        </div>
                        <div className="study-log-right">
                          <span className="study-log-hours">{log.hours.toFixed(1)} hrs</span>
                          <button
                            type="button"
                            className="study-log-delete-btn"
                            onClick={() => onDeleteStudyLog(log.id)}
                            title="Delete session"
                            aria-label="Delete session"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }

              if (hasHoursRecorded) {
                return (
                  <div className="study-log-empty-legacy">
                    <p style={{ margin: 0, lineHeight: 1.5 }}>
                      No detailed session logs found for this date, but a total of <strong>{todayFocusHours.toFixed(1)} hours</strong> is recorded.
                    </p>
                    <button
                      type="button"
                      className="reset-daily-total-btn"
                      onClick={() => {
                        onResetDailyTotal(selectedDate);
                        setIsLogModalOpen(false);
                      }}
                    >
                      Clear Daily Total
                    </button>
                  </div>
                );
              }

              return (
                <div className="study-log-empty-state">
                  <Clock size={36} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>No study sessions logged for this date.</p>
                </div>
              );
            })()}

            <div className="matrix-modal-actions mt-4">
              <button 
                type="button" 
                className="matrix-modal-cancel-btn" 
                style={{ width: '100%' }}
                onClick={() => setIsLogModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
