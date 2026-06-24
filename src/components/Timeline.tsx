import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Calendar, Plus, Edit2, Trash2, CheckCircle, 
  Clock, AlertCircle, X, Info
} from 'lucide-react';
import { CustomSelect } from './CustomSelect';

export interface TimelinePhase {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'pending' | 'in-progress' | 'completed';
  color: string; // 'indigo' | 'sky' | 'amber' | 'emerald' | 'rose'
  notes?: string;
  completedDays?: string[]; // Date strings representing checked-off days
}

interface TimelineProps {
  examStartDate: string;
  onUpdateExamStartDate: (date: string) => void;
  timelinePhases: TimelinePhase[];
  onUpdateTimelinePhases: (phases: TimelinePhase[]) => void;
  onBack: () => void;
}

const COLOR_OPTIONS = [
  { value: 'indigo', label: 'Indigo Purple', hex: '#6366f1' },
  { value: 'sky', label: 'Sky Blue', hex: '#0ea5e9' },
  { value: 'amber', label: 'Amber Orange', hex: '#d97706' },
  { value: 'emerald', label: 'Emerald Green', hex: '#10b981' },
  { value: 'rose', label: 'Rose Red', hex: '#f43f5e' }
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' }
];

// Helper to format date cleanly (e.g., "24 Jun 2026")
const formatDateFriendly = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDaysDiff = (startStr: string, endStr: string) => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  // Clear times to compare clean dates
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
};

const getDatesInRange = (startStr: string, endStr: string) => {
  const dates = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const curr = new Date(start);
  let safetyCounter = 0;
  while (curr <= end && safetyCounter < 100) {
    const year = curr.getFullYear();
    const month = String(curr.getMonth() + 1).padStart(2, '0');
    const day = String(curr.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    curr.setDate(curr.getDate() + 1);
    safetyCounter++;
  }
  return dates;
};

export const Timeline: React.FC<TimelineProps> = ({
  examStartDate,
  onUpdateExamStartDate,
  timelinePhases,
  onUpdateTimelinePhases,
  onBack
}) => {
  const todayStr = useMemo(() => getLocalDateString(), []);
  
  // Local state for modals/forms
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [tempExamDate, setTempExamDate] = useState(examStartDate || todayStr);
  
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  
  // Phase Form fields
  const [phaseName, setPhaseName] = useState('');
  const [phaseStart, setPhaseStart] = useState('');
  const [phaseEnd, setPhaseEnd] = useState('');
  const [phaseStatus, setPhaseStatus] = useState<string>('pending');
  const [phaseColor, setPhaseColor] = useState('indigo');
  const [phaseNotes, setPhaseNotes] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');

  // Calculate days remaining till exam
  const daysLeft = useMemo(() => {
    if (!examStartDate) return 0;
    return getDaysDiff(todayStr, examStartDate);
  }, [examStartDate, todayStr]);

  // Sort phases chronologically by start date
  const sortedPhases = useMemo(() => {
    return [...timelinePhases].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [timelinePhases]);

  // Overall progress based on status of phases
  const timelineProgressPercent = useMemo(() => {
    if (timelinePhases.length === 0) return 0;
    const completedCount = timelinePhases.filter(p => p.status === 'completed').length;
    const inProgressCount = timelinePhases.filter(p => p.status === 'in-progress').length;
    // in-progress counted as half-done for stats
    const score = completedCount * 100 + inProgressCount * 50;
    return Math.round(score / timelinePhases.length);
  }, [timelinePhases]);

  // Group sorted phases into clusters of overlapping intervals
  const clusteredPhases = useMemo(() => {
    if (sortedPhases.length === 0) return [];
    const clusters: TimelinePhase[][] = [[sortedPhases[0]]];
    
    for (let i = 1; i < sortedPhases.length; i++) {
      const phase = sortedPhases[i];
      const lastCluster = clusters[clusters.length - 1];
      
      const maxEndDate = lastCluster.reduce((max, p) => p.endDate > max ? p.endDate : max, lastCluster[0].endDate);
      const minStartDate = lastCluster.reduce((min, p) => p.startDate < min ? p.startDate : min, lastCluster[0].startDate);
      
      const overlaps = (phase.startDate <= maxEndDate && phase.endDate >= minStartDate);
      
      if (overlaps) {
        lastCluster.push(phase);
      } else {
        clusters.push([phase]);
      }
    }
    return clusters;
  }, [sortedPhases]);

  // Toggle status of a single day block in a phase
  const handleToggleDay = (phaseId: string, dateStr: string) => {
    onUpdateTimelinePhases(
      timelinePhases.map(p => {
        if (p.id !== phaseId) return p;
        const currentCompleted = p.completedDays || [];
        const nextCompleted = currentCompleted.includes(dateStr)
          ? currentCompleted.filter(d => d !== dateStr)
          : [...currentCompleted, dateStr];
        
        // Auto-complete status if all days checked off, or set to in-progress if one is checked
        const totalDaysCount = getDatesInRange(p.startDate, p.endDate).length;
        const statusVal = nextCompleted.length === totalDaysCount
          ? 'completed'
          : nextCompleted.length > 0 && p.status === 'pending'
            ? 'in-progress'
            : p.status;

        return {
          ...p,
          completedDays: nextCompleted,
          status: statusVal
        };
      })
    );
  };

  // Click badge to cycle phase status
  const handleCycleStatus = (id: string, current: TimelinePhase['status']) => {
    const order: TimelinePhase['status'][] = ['pending', 'in-progress', 'completed'];
    const nextIndex = (order.indexOf(current) + 1) % order.length;
    const nextStatus = order[nextIndex];
    onUpdateTimelinePhases(
      timelinePhases.map(p => p.id === id ? { ...p, status: nextStatus } : p)
    );
  };

  // Open phase editor
  const handleOpenAddPhase = () => {
    setEditingPhaseId(null);
    setPhaseName('');
    setPhaseStart(todayStr);
    setPhaseEnd(addDays(todayStr, 14)); // 2 weeks default
    setPhaseStatus('pending');
    setPhaseColor('indigo');
    setPhaseNotes('');
    setErrorMsg('');
    setShowEditorModal(true);
  };

  const handleOpenEditPhase = (phase: TimelinePhase) => {
    setEditingPhaseId(phase.id);
    setPhaseName(phase.name);
    setPhaseStart(phase.startDate);
    setPhaseEnd(phase.endDate);
    setPhaseStatus(phase.status);
    setPhaseColor(phase.color);
    setPhaseNotes(phase.notes || '');
    setErrorMsg('');
    setShowEditorModal(true);
  };

  // Save phase (create or update)
  const handleSavePhase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phaseName.trim()) {
      setErrorMsg('Phase name is required.');
      return;
    }
    if (!phaseStart || !phaseEnd) {
      setErrorMsg('Start date and End date are required.');
      return;
    }
    if (phaseStart > phaseEnd) {
      setErrorMsg('Start date cannot be after End date.');
      return;
    }

    const existingPhase = editingPhaseId ? timelinePhases.find(p => p.id === editingPhaseId) : null;
    const phaseData: TimelinePhase = {
      id: editingPhaseId || `phase-${Date.now()}`,
      name: phaseName.trim(),
      startDate: phaseStart,
      endDate: phaseEnd,
      status: phaseStatus as TimelinePhase['status'],
      color: phaseColor,
      notes: phaseNotes.trim(),
      completedDays: existingPhase ? existingPhase.completedDays : []
    };

    if (editingPhaseId) {
      // Update
      onUpdateTimelinePhases(
        timelinePhases.map(p => p.id === editingPhaseId ? phaseData : p)
      );
    } else {
      // Add
      onUpdateTimelinePhases([...timelinePhases, phaseData]);
    }

    setShowEditorModal(false);
    setErrorMsg('');
  };

  // Delete phase
  const handleDeletePhase = (id: string) => {
    onUpdateTimelinePhases(timelinePhases.filter(p => p.id !== id));
  };

  // Set exam date
  const handleSaveExamDate = () => {
    if (!tempExamDate) return;
    onUpdateExamStartDate(tempExamDate);
    setShowDatePickerModal(false);
  };

  return (
    <div className="timeline-container fade-in">
      {/* Header */}
      <div className="tools-header-bar">
        <button 
          type="button" 
          className="tools-back-btn" 
          onClick={onBack}
          aria-label="Back to tools"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <h2 className="tools-header-title">Timeline</h2>
      </div>

      {/* Main Content Area */}
      <div className="timeline-page-content">
        
        {/* Step 1: Exam Date Config */}
        {!examStartDate ? (
          <div className="timeline-empty-card">
            <div className="timeline-card-icon-pulse">
              <Calendar size={32} className="text-indigo" />
            </div>
            <h3>When are your Exams?</h3>
            <p>Set your target exam start date to visualize the remaining preparation days and build a scheduled revision timeline.</p>
            <div className="timeline-date-setup-form">
              <input 
                type="date" 
                className="planner-log-input"
                value={tempExamDate}
                onChange={(e) => setTempExamDate(e.target.value)}
                min={todayStr}
              />
              <button 
                type="button" 
                className="planner-add-log-btn"
                onClick={handleSaveExamDate}
              >
                Set Exam Date
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Dashboard Summary Card */}
            <div className="timeline-dashboard-card">
              <div className="timeline-dash-header">
                <div>
                  <span className="timeline-dash-label">Target Exam Date</span>
                  <h3 className="timeline-dash-date-val">{formatDateFriendly(examStartDate)}</h3>
                </div>
                <button 
                  type="button" 
                  className="timeline-edit-date-btn"
                  onClick={() => {
                    setTempExamDate(examStartDate);
                    setShowDatePickerModal(true);
                  }}
                >
                  Change Date
                </button>
              </div>

              <div className="timeline-stats-grid">
                <div className="timeline-stat-box">
                  <span className="timeline-stat-num text-rose">
                    {daysLeft > 0 ? daysLeft : 0}
                  </span>
                  <span className="timeline-stat-lbl">Days Left</span>
                </div>
                
                <div className="timeline-stat-box">
                  <span className="timeline-stat-num text-indigo">
                    {sortedPhases.length}
                  </span>
                  <span className="timeline-stat-lbl">Planned Phases</span>
                </div>

                <div className="timeline-stat-box">
                  <span className="timeline-stat-num text-emerald">
                    {timelineProgressPercent}%
                  </span>
                  <span className="timeline-stat-lbl">Overall Progress</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="timeline-dash-actions">
                <button 
                  type="button" 
                  className="timeline-btn-primary"
                  onClick={handleOpenAddPhase}
                  style={{ width: '100%' }}
                >
                  <Plus size={16} />
                  <span>Add Phase</span>
                </button>
              </div>

              {errorMsg && (
                <div className="timeline-alert-error">
                  <AlertCircle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Visual Timeline Section */}
            <div className="timeline-track-section">
              <h3 className="timeline-section-title">Your Study Road</h3>
              
              {sortedPhases.length === 0 ? (
                <div className="timeline-track-empty">
                  <Info size={16} />
                  <p>No study phases planned. Click <strong>Add Phase</strong> above to set up your custom revision schedule.</p>
                </div>
              ) : (
                <div className="timeline-visual-track">
                  {/* Vertical line connector */}
                  <div className="timeline-vertical-bar" />

                  {/* Render phases grouped by clusters */}
                  {clusteredPhases.map((cluster, cIdx) => {
                    const hasInProgress = cluster.some(p => p.status === 'in-progress');
                    const allCompleted = cluster.every(p => p.status === 'completed');
                    const bulletColor = cluster[0].color;

                    return (
                      <div key={cIdx} className="timeline-node-item">
                        {/* Bullet point on the line */}
                        <div className={`timeline-node-bullet ${bulletColor} ${hasInProgress ? 'pulse' : ''}`}>
                          {allCompleted ? (
                            <CheckCircle size={18} className="bullet-icon-check" />
                          ) : hasInProgress ? (
                            <Clock size={16} className="bullet-icon-clock" />
                          ) : (
                            <div className="bullet-dot-hollow" />
                          )}
                        </div>

                        {/* Cluster container row - holds cards side-by-side if they overlap */}
                        <div className="timeline-cluster-row">
                          {cluster.map((phase) => {
                            const isInProgress = phase.status === 'in-progress';
                            const duration = getDaysDiff(phase.startDate, phase.endDate);
                            const daysRemainingInPhase = getDaysDiff(todayStr, phase.endDate);

                            const dates = getDatesInRange(phase.startDate, phase.endDate);
                            const completedDaysCount = phase.completedDays ? phase.completedDays.length : 0;
                            const progressPercent = duration > 0 ? Math.round((completedDaysCount / duration) * 100) : 0;

                            return (
                              <div key={phase.id} className={`timeline-node-card border-${phase.color}`}>
                                <div className="timeline-card-header">
                                  <div className="timeline-card-tag-row">
                                    <button
                                      type="button"
                                      className={`timeline-status-badge ${phase.status} clickable`}
                                      onClick={() => handleCycleStatus(phase.id, phase.status)}
                                      title="Click to cycle status"
                                    >
                                      {phase.status === 'completed' ? 'Completed' : phase.status === 'in-progress' ? 'In Progress' : 'Pending'}
                                    </button>
                                    <span className="timeline-duration-badge">
                                      {duration > 0 ? `${duration} days` : '1 day'}
                                    </span>
                                  </div>
                                  
                                  <div className="timeline-card-actions">
                                    <button 
                                      type="button" 
                                      className="action-icon-btn edit"
                                      onClick={() => handleOpenEditPhase(phase)}
                                      aria-label="Edit phase"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button 
                                      type="button" 
                                      className="action-icon-btn delete"
                                      onClick={() => handleDeletePhase(phase.id)}
                                      aria-label="Delete phase"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>

                                <h4 className="timeline-card-title">{phase.name}</h4>
                                
                                <div className="timeline-card-dates">
                                  <Calendar size={12} />
                                  <span>{formatDateFriendly(phase.startDate)} – {formatDateFriendly(phase.endDate)}</span>
                                </div>

                                {phase.notes && (
                                  <p className="timeline-card-notes">{phase.notes}</p>
                                )}

                                {/* Daily Blocks Tracker Grid */}
                                {duration > 0 && (
                                  <div className="timeline-progress-tracker">
                                    <div className="timeline-progress-lbl-row">
                                      <span>Daily Progress ({completedDaysCount}/{duration} Days)</span>
                                      <span className="bold">{progressPercent}%</span>
                                    </div>
                                    <div className="timeline-day-grid">
                                      {dates.map((dateStr) => {
                                        const isDayCompleted = phase.completedDays?.includes(dateStr) || false;
                                        const isDayPastOrToday = dateStr <= todayStr;
                                        
                                        let dayClass = 'future';
                                        if (isDayCompleted) {
                                          dayClass = 'completed';
                                        } else if (isDayPastOrToday) {
                                          dayClass = 'elapsed';
                                        }

                                        return (
                                          <button
                                            key={dateStr}
                                            type="button"
                                            className={`timeline-day-block ${phase.color} ${dayClass}`}
                                            onClick={() => handleToggleDay(phase.id, dateStr)}
                                            title={`${formatDateFriendly(dateStr)}: ${isDayCompleted ? 'Done' : isDayPastOrToday ? 'Missed/Not Logged' : 'Future'}`}
                                            aria-label={`Toggle day ${formatDateFriendly(dateStr)}`}
                                          />
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {isInProgress && daysRemainingInPhase > 0 && (
                                  <div className="timeline-phase-remaining-alert">
                                    <span>🎯 {daysRemainingInPhase} days remaining</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MODAL 1: Exam Date Picker */}
      {showDatePickerModal && (
        <div className="portal-modal-overlay">
          <div className="portal-modal-card fade-in">
            <div className="portal-modal-header">
              <h3 className="portal-modal-title">Set Exam Date</h3>
              <button 
                type="button" 
                className="portal-modal-close"
                onClick={() => setShowDatePickerModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="portal-modal-body">
              <div className="planner-log-form-group">
                <label className="planner-log-lbl">Target Exam Start Date</label>
                <input 
                  type="date" 
                  className="planner-log-input"
                  value={tempExamDate}
                  onChange={(e) => setTempExamDate(e.target.value)}
                  min={todayStr}
                />
              </div>
              <p className="timeline-modal-hint">
                <Info size={14} />
                Changing the exam date will update the days remaining countdown on your dashboard.
              </p>
            </div>

            <div className="portal-modal-footer">
              <button 
                type="button" 
                className="timeline-btn-modal-cancel"
                onClick={() => setShowDatePickerModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="timeline-btn-modal-save"
                onClick={handleSaveExamDate}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add/Edit Phase Editor */}
      {showEditorModal && (
        <div className="portal-modal-overlay">
          <div className="portal-modal-card fade-in">
            <div className="portal-modal-header">
              <h3 className="portal-modal-title">
                {editingPhaseId ? 'Edit Study Phase' : 'Add New Phase'}
              </h3>
              <button 
                type="button" 
                className="portal-modal-close"
                onClick={() => setShowEditorModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSavePhase} className="portal-modal-body">
              <div className="planner-log-form-group">
                <label className="planner-log-lbl">Phase Title</label>
                <input 
                  type="text" 
                  className="planner-log-input"
                  placeholder="e.g. Revision 1, Solve PyPs"
                  value={phaseName}
                  onChange={(e) => setPhaseName(e.target.value)}
                  maxLength={60}
                  required
                />
              </div>

              <div className="timeline-form-row">
                <div className="planner-log-form-group flex-1">
                  <label className="planner-log-lbl">Start Date</label>
                  <input 
                    type="date" 
                    className="planner-log-input"
                    value={phaseStart}
                    onChange={(e) => setPhaseStart(e.target.value)}
                    required
                  />
                </div>
                <div className="planner-log-form-group flex-1">
                  <label className="planner-log-lbl">End Date</label>
                  <input 
                    type="date" 
                    className="planner-log-input"
                    value={phaseEnd}
                    onChange={(e) => setPhaseEnd(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="planner-log-form-group">
                <label className="planner-log-lbl">Status</label>
                <CustomSelect
                  value={phaseStatus}
                  onChange={(val) => setPhaseStatus(val)}
                  options={STATUS_OPTIONS}
                />
              </div>

              <div className="planner-log-form-group">
                <label className="planner-log-lbl">Theme Accent Color</label>
                <div className="timeline-color-picker">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      className={`timeline-color-dot ${c.value} ${phaseColor === c.value ? 'selected' : ''}`}
                      onClick={() => setPhaseColor(c.value)}
                      title={c.label}
                      aria-label={`Select ${c.label}`}
                    >
                      {phaseColor === c.value && <CheckCircle size={14} className="checkmark" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="planner-log-form-group">
                <label className="planner-log-lbl">Phase Notes & Milestones (Optional)</label>
                <textarea 
                  className="planner-log-input textarea"
                  placeholder="What are your goals for this phase? e.g. Revise advanced accounting R1, finish classes."
                  value={phaseNotes}
                  onChange={(e) => setPhaseNotes(e.target.value)}
                  rows={3}
                  maxLength={300}
                />
              </div>

              {errorMsg && (
                <div className="timeline-alert-error">
                  <AlertCircle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="portal-modal-footer pad-none">
                <button 
                  type="button" 
                  className="timeline-btn-modal-cancel"
                  onClick={() => setShowEditorModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="timeline-btn-modal-save"
                >
                  {editingPhaseId ? 'Update Phase' : 'Create Phase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
