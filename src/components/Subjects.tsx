import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Trash2, Plus, Search, Filter, Play, Sparkles, Check, CheckCircle, Bold, Italic, Underline, List, Highlighter, Palette } from 'lucide-react';
import { SYLLABUS_DATA } from '../constants/syllabus';

export interface ChapterStatus {
  classDone: boolean;
  priority: 'A' | 'B' | 'C';
  ldrs: boolean;
  revisionCycle: number; // 0 = none, 1, 2, 3 cycles
  isCustom?: boolean;
  videoUrl?: string;
  ldrNotes?: string;
}

export interface ProgressState {
  [subjectName: string]: {
    [chapterName: string]: ChapterStatus;
  };
}

interface SubjectsProps {
  caLevel: string;
  progressState: ProgressState;
  onToggleClass: (subName: string, chapName: string) => void;
  onSetPriority: (subName: string, chapName: string, priority: 'A' | 'B' | 'C') => void;
  onToggleLdrs: (subName: string, chapName: string) => void;
  onToggleRevisionCycle: (subName: string, chapName: string, cycle: number) => void;
  onAddChapter: (subName: string, chapName: string, priority: 'A' | 'B' | 'C') => void;
  onDeleteChapter: (subName: string, chapName: string) => void;
  onAddSubject: (subName: string) => void;
  onDeleteSubject: (subName: string) => void;
  onSetVideoUrl: (subName: string, chapName: string, url: string) => void;
  onSetLdrNotes: (subName: string, chapName: string, notes: string, ldrs: boolean) => void;
}

export const Subjects: React.FC<SubjectsProps> = ({
  caLevel,
  progressState,
  onToggleClass,
  onSetPriority,
  onToggleRevisionCycle,
  onAddChapter,
  onDeleteChapter,
  onAddSubject,
  onDeleteSubject,
  onSetVideoUrl,
  onSetLdrNotes,
}) => {
  const currentSyllabus = (SYLLABUS_DATA[caLevel as keyof typeof SYLLABUS_DATA] || SYLLABUS_DATA.Intermediate) as Record<string, string[]>;

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
  
  // Local UI States
  const [expandedSubjects, setExpandedSubjects] = useState<{ [key: string]: boolean }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [editingVideo, setEditingVideo] = useState<{ subName: string; chapName: string; url: string } | null>(null);

  const [activeLdrNote, setActiveLdrNote] = useState<{
    subName: string;
    chapName: string;
    notes: string;
    ldrs: boolean;
  } | null>(null);

  const handleLdrClick = (subName: string, chapName: string) => {
    const status = progressState[subName]?.[chapName];
    const currentNotes = status?.ldrNotes || '';
    const currentLdrs = status?.ldrs || false;
    setActiveLdrNote({
      subName,
      chapName,
      notes: currentNotes,
      ldrs: currentLdrs,
    });
  };

  const handlePlayClick = (subName: string, chapName: string) => {
    const status = progressState[subName]?.[chapName];
    const currentUrl = status?.videoUrl || '';
    setEditingVideo({ subName, chapName, url: currentUrl });
  };

  const editorRef = useRef<HTMLDivElement>(null);

  const execCmd = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const isHtmlEmpty = (html: string) => {
    const text = html.replace(/<[^>]*>/g, '').trim();
    return text === '';
  };

  useEffect(() => {
    if (activeLdrNote && editorRef.current) {
      editorRef.current.innerHTML = activeLdrNote.notes;
    }
  }, [activeLdrNote]);

  const handleToggleStatusFilter = (val: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]
    );
  };
  
  // New Chapter Form States
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [newChapterSub, setNewChapterSub] = useState(Object.keys(currentSyllabus)[0]);
  const [newChapterPriority, setNewChapterPriority] = useState<'A' | 'B' | 'C'>('A');

  // New Subject Form States
  const [showAddSubForm, setShowAddSubForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  const toggleSubjectExpand = (subName: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subName]: !prev[subName],
    }));
  };

  // Compile full chapters list dynamically (incorporating custom ones)
  const getSubjectChapters = (subName: string) => {
    const defaultChaps = currentSyllabus[subName as keyof typeof currentSyllabus] || [];
    const stateChaps = progressState[subName] ? Object.keys(progressState[subName]) : [];
    
    // Only include default chapters that still exist in progressState
    // (deleted chapters will have been removed from progressState)
    const merged = defaultChaps.filter((c) =>
      progressState[subName]?.[c] !== undefined
    );

    // Add custom chapters (those in state but not in defaults)
    stateChaps.forEach((c) => {
      if (!merged.includes(c)) {
        merged.push(c);
      }
    });

    return merged;
  };



  const handleAddNewChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterName.trim()) return;
    onAddChapter(newChapterSub, newChapterName.trim(), newChapterPriority);
    setNewChapterName('');
    setShowAddForm(false);
    // Auto-expand that subject folder
    setExpandedSubjects(prev => ({ ...prev, [newChapterSub]: true }));
    alert(`Added chapter to ${newChapterSub}!`);
  };

  const handleAddNewSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    onAddSubject(newSubjectName.trim());
    setNewChapterSub(newSubjectName.trim());
    setNewSubjectName('');
    setShowAddSubForm(false);
    setExpandedSubjects((prev) => ({ ...prev, [newSubjectName.trim()]: true }));
    alert(`Subject "${newSubjectName.trim()}" added!`);
  };


  // Calculate subject progress ratio
  const calculateSubjectProgress = (subName: string, chapters: string[]) => {
    if (chapters.length === 0) return 0;
    let completedPoints = 0;
    const totalPoints = chapters.length * 4; // 1 (Class) + 3 (Revisions)

    chapters.forEach((chap) => {
      const status = progressState[subName]?.[chap];
      if (status) {
        if (status.classDone) completedPoints++;
        completedPoints += Math.min(status.revisionCycle, 3);
      }
    });

    return Math.round((completedPoints / totalPoints) * 100);
  };

  return (
    <div className="subjects-container fade-in">
      {/* Title Header */}
      <div className="welcome-banner" style={{ marginBottom: '16px' }}>
        <div>
          <span className="level-badge">{caLevel} Syllabus</span>
          <h2 className="welcome-title">My Subjects</h2>
          <p className="welcome-subtitle">Manage priorities, classes & revisions</p>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="filter-card">
        <div className="filter-actions-row">
          <div className="filter-dropdowns-group">
            {/* Status Dropdown */}
            <div className="status-dropdown-wrapper">
              <button
                type="button"
                className="status-dropdown-trigger"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              >
                <CheckCircle size={16} className="status-icon" />
                <span>Status</span>
                <ChevronDown size={14} className="chevron-icon" />
              </button>

              {showStatusDropdown && (
                <>
                  <div className="dropdown-overlay" onClick={() => setShowStatusDropdown(false)} />
                  <div className="status-dropdown-popover">
                    <label className="status-popover-item">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes('NO_CLASS')}
                        onChange={() => handleToggleStatusFilter('NO_CLASS')}
                        className="status-popover-checkbox"
                      />
                      <span className="status-popover-label">No Class Done</span>
                    </label>
                    <label className="status-popover-item">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes('CLASS_DONE')}
                        onChange={() => handleToggleStatusFilter('CLASS_DONE')}
                        className="status-popover-checkbox"
                      />
                      <span className="status-popover-label">Class Done</span>
                    </label>
                    <label className="status-popover-item">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes('R1_DONE')}
                        onChange={() => handleToggleStatusFilter('R1_DONE')}
                        className="status-popover-checkbox"
                      />
                      <span className="status-popover-label">R1 Done</span>
                    </label>
                    <label className="status-popover-item">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes('R2_DONE')}
                        onChange={() => handleToggleStatusFilter('R2_DONE')}
                        className="status-popover-checkbox"
                      />
                      <span className="status-popover-label">R2 Done</span>
                    </label>
                    <label className="status-popover-item">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes('R3_DONE')}
                        onChange={() => handleToggleStatusFilter('R3_DONE')}
                        className="status-popover-checkbox"
                      />
                      <span className="status-popover-label">R3 Done</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Priority Filter Select Pill */}
            <div className="priority-select-wrapper">
              <Filter size={13} className="priority-select-icon" />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | 'A' | 'B' | 'C')}
                className="priority-pill-select"
              >
                <option value="ALL">All Priorities</option>
                <option value="A">Priority A</option>
                <option value="B">Priority B</option>
                <option value="C">Priority C</option>
              </select>
            </div>
          </div>

          {/* Search bar */}
          <div className="search-bar-wrapper">
            <Search size={16} className="search-bar-icon" />
            <input
              type="text"
              placeholder="Find..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-bar-input"
            />
          </div>
        </div>
      </div>

      {/* Add New Chapter & Add Subject Buttons */}
      <div className="add-chapter-wrapper">
        <div className="add-buttons-row">
          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowAddSubForm(false);
            }}
            className={`drawer-toggle-btn ${showAddForm ? 'active' : ''}`}
          >
            <Plus size={14} className="btn-icon-plus" />
            <span className="btn-label-text">Chapter</span>
            {showAddForm ? (
              <ChevronUp size={14} className="btn-icon-chevron" />
            ) : (
              <ChevronDown size={14} className="btn-icon-chevron" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAddSubForm(!showAddSubForm);
              setShowAddForm(false);
            }}
            className={`drawer-toggle-btn ${showAddSubForm ? 'active' : ''}`}
          >
            <Plus size={14} className="btn-icon-plus" />
            <span className="btn-label-text">Subject</span>
            {showAddSubForm ? (
              <ChevronUp size={14} className="btn-icon-chevron" />
            ) : (
              <ChevronDown size={14} className="btn-icon-chevron" />
            )}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddNewChapter} className="add-chapter-form slide-up mt-2">
            <div className="input-group">
              <label>Chapter Name</label>
              <input
                type="text"
                placeholder="e.g. Internal Audit"
                value={newChapterName}
                onChange={(e) => setNewChapterName(e.target.value)}
                required
                className="styled-task-input"
              />
            </div>
            <div className="form-row mt-2">
              <div className="input-group">
                <label>Subject</label>
                <select
                  value={newChapterSub}
                  onChange={(e) => setNewChapterSub(e.target.value)}
                  className="styled-select"
                >
                  {getAllSubjects().map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
              <div className="input-group shrink">
                <label>Priority</label>
                <select
                  value={newChapterPriority}
                  onChange={(e) => setNewChapterPriority(e.target.value as 'A' | 'B' | 'C')}
                  className="styled-select"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </div>
            </div>
            <button type="submit" className="action-button-primary mt-3 py-2 text-sm">
              <span>Add Chapter</span>
            </button>
          </form>
        )}

        {showAddSubForm && (
          <form onSubmit={handleAddNewSubject} className="add-chapter-form slide-up mt-2">
            <div className="input-group">
              <label>Subject Name</label>
              <input
                type="text"
                placeholder="e.g. Strategic Management"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                required
                className="styled-task-input"
              />
            </div>
            <button type="submit" className="action-button-primary mt-3 py-2 text-sm">
              <span>Add Subject</span>
            </button>
          </form>
        )}
      </div>

      {/* Subject Expandable Folders */}
      <div className="subject-collapsible-list">
        {getAllSubjects().map((subName) => {
          const chapters = getSubjectChapters(subName);
          const isExpanded = !!expandedSubjects[subName];
          const progress = calculateSubjectProgress(subName, chapters);

          // Apply filters to chapters
          const filteredChapters = chapters.filter((chap) => {
            const status = progressState[subName]?.[chap] || {
              classDone: false,
              priority: 'C',
              ldrs: false,
              revisionCycle: 0,
            };
            const p = status.priority;

            // Search Query filter
            if (searchQuery.trim() && !chap.toLowerCase().includes(searchQuery.toLowerCase())) {
              return false;
            }
            // Priority filter
            if (priorityFilter !== 'ALL' && p !== priorityFilter) {
              return false;
            }
            // Status checkbox filter list (match any selected condition - OR)
            if (selectedStatuses.length > 0) {
              const matchesAny = selectedStatuses.some((filterVal) => {
                if (filterVal === 'NO_CLASS') return !status.classDone;
                if (filterVal === 'CLASS_DONE') return status.classDone;
                if (filterVal === 'R1_DONE') return status.revisionCycle >= 1;
                if (filterVal === 'R2_DONE') return status.revisionCycle >= 2;
                if (filterVal === 'R3_DONE') return status.revisionCycle >= 3;
                return true;
              });
              if (!matchesAny) return false;
            }

            return true;
          });

          // Don't render subject card if searching and no matches found
          if (searchQuery.trim() && filteredChapters.length === 0) {
            return null;
          }

          return (
            <div key={subName} className="subject-expand-card">
              <div 
                className="subject-expand-header"
                onClick={() => toggleSubjectExpand(subName)}
              >
                <div className="subject-header-left">
                  <div className="subject-header-details">
                    <span className="subject-name-txt">{subName}</span>
                    <div className="subject-header-meta">
                      <span className="subject-progress-badge">{progress}% Done</span>
                      <span className="subject-chapters-count">{filteredChapters.length} Chapters</span>
                    </div>
                  </div>
                </div>
                <div className="subject-header-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete subject "${subName}" and all its chapters?`)) {
                        onDeleteSubject(subName);
                      }
                    }}
                    className="subject-delete-btn"
                    title="Delete Subject"
                  >
                    <Trash2 size={16} />
                  </button>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>

              {/* Progress mini indicator line */}
              <div className="subject-progress-line-bg">
                <div 
                  className="subject-progress-line-fill" 
                  style={{ width: `${progress}%` }}
                />
              </div>

              {isExpanded && (
                <div className="planner-chapters-list slide-up">
                  {filteredChapters.length === 0 ? (
                    <p className="no-chapters-filter">
                      {chapters.length === 0 
                        ? "This subject is empty. Click + Chapter above to add one!" 
                        : "No chapters match your filter."}
                    </p>
                  ) : (
                    filteredChapters.map((chap) => {
                      const status = progressState[subName]?.[chap] || {
                        classDone: false,
                        priority: 'C',
                        ldrs: false,
                        revisionCycle: 0,
                      };

                      return (
                        <div key={chap} className="planner-chapter-card">
                          {/* Top Row: Class Status & Title & Actions */}
                          <div className="chapter-card-header">
                            <div className="class-status-box">
                              <span className="box-lbl">CLASS</span>
                              <button
                                type="button"
                                onClick={() => onToggleClass(subName, chap)}
                                className={`class-checkbox ${status.classDone ? 'checked' : ''}`}
                              >
                                {status.classDone && <Check size={14} />}
                              </button>
                            </div>
                            <span className="chapter-card-title">{chap}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete chapter "${chap}"?`)) {
                                  onDeleteChapter(subName, chap);
                                }
                              }}
                              className="chapter-card-delete"
                              title="Delete Chapter"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Control Row 1: Priority Selection & LDRS marker */}
                          <div className="chapter-card-controls">
                            <div className="priority-select-area">
                              <span className="control-lbl">PRIORITY</span>
                              <div className="priority-btn-group">
                                {(['A', 'B', 'C'] as const).map((p) => {
                                  const isActive = status.priority === p;
                                  return (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => onSetPriority(subName, chap, p)}
                                      className={`priority-btn ${p} ${isActive ? 'active' : ''}`}
                                    >
                                      {p}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* LDRS Toggle button */}
                            <div className="ldrs-toggle-area">
                              <span className="control-lbl">LDRS</span>
                              <button
                                type="button"
                                onClick={() => handleLdrClick(subName, chap)}
                                className={`ldrs-btn ${status.ldrs ? 'active' : ''}`}
                              >
                                <Sparkles size={12} fill={status.ldrs ? 'currentColor' : 'none'} />
                                <span>MARK LDRS</span>
                              </button>
                            </div>
                          </div>

                          {/* Control Row 2: Revision Cycle indicators (1, 2, 3) */}
                          <div className="chapter-card-controls pt-2">
                            <div className="revision-cycle-area">
                              <span className="control-lbl">REVISION CYCLE</span>
                              <div className="cycle-btn-group">
                                {([1, 2, 3] as const).map((cycleNum) => {
                                  const isChecked = status.revisionCycle >= cycleNum;
                                  return (
                                    <button
                                      key={cycleNum}
                                      type="button"
                                      onClick={() => onToggleRevisionCycle(subName, chap, cycleNum)}
                                      className={`cycle-btn ${isChecked ? 'active' : ''}`}
                                    >
                                      {cycleNum}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Resource Actions (watch) */}
                            <div className="resource-actions-area">
                              <button
                                type="button"
                                onClick={() => handlePlayClick(subName, chap)}
                                className={`resource-action-btn ${status.videoUrl ? 'has-video' : ''}`}
                                title={status.videoUrl ? "Watch Lecture" : "Add YouTube Link"}
                              >
                                <Play size={14} fill="currentColor" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingVideo && createPortal(
        <div className="modal-overlay fade-in" onClick={() => setEditingVideo(null)}>
          <div className="modal-content slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Lecture Video URL</h3>
            <p className="modal-subtitle">Add or edit YouTube video for: <strong>{editingVideo.chapName}</strong></p>
            
            <div className="input-group mt-3">
              <label>YouTube Link</label>
              <input
                type="text"
                placeholder="e.g. https://www.youtube.com/watch?v=..."
                value={editingVideo.url}
                onChange={(e) => setEditingVideo({ ...editingVideo, url: e.target.value })}
                className="styled-task-input"
                autoFocus
              />
            </div>
            
            <div className="modal-actions-row mt-4">
              {editingVideo.url && (
                <button
                  type="button"
                  onClick={() => {
                    let finalUrl = editingVideo.url.trim();
                    if (finalUrl) {
                      if (!/^https?:\/\//i.test(finalUrl)) {
                        finalUrl = 'https://' + finalUrl;
                      }
                      
                      if (!finalUrl.includes('youtube.com') && !finalUrl.includes('youtu.be')) {
                        if (/^[a-zA-Z0-9_-]{11}$/.test(finalUrl)) {
                           finalUrl = `https://www.youtube.com/watch?v=${finalUrl}`;
                        }
                      }
                      
                      window.open(finalUrl, '_blank');
                    }
                  }}
                  className="modal-action-btn watch"
                >
                  <Play size={16} fill="currentColor" />
                  <span>Play Video</span>
                </button>
              )}
              
              <button
                type="button"
                onClick={() => {
                  onSetVideoUrl(editingVideo.subName, editingVideo.chapName, editingVideo.url.trim());
                  setEditingVideo(null);
                }}
                className="modal-action-btn save"
              >
                <span>Save</span>
              </button>
              
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="modal-action-btn cancel"
              >
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {activeLdrNote && createPortal(
        <div className="notepad-page fade-in">
          {/* Header */}
          <div className="notepad-header">
            <button
              type="button"
              className="notepad-back-btn"
              onClick={() => {
                const notesHtml = editorRef.current?.innerHTML || '';
                onSetLdrNotes(activeLdrNote.subName, activeLdrNote.chapName, notesHtml, !isHtmlEmpty(notesHtml));
                setActiveLdrNote(null);
              }}
            >
              ← Back
            </button>
            <div className="notepad-header-title">
              <span className="notepad-subject-label">{activeLdrNote.subName}</span>
              <h4 className="notepad-chapter-title">{activeLdrNote.chapName}</h4>
            </div>
            <button
              type="button"
              className="notepad-save-btn"
              onClick={() => {
                const notesHtml = editorRef.current?.innerHTML || '';
                onSetLdrNotes(activeLdrNote.subName, activeLdrNote.chapName, notesHtml, !isHtmlEmpty(notesHtml));
                setActiveLdrNote(null);
                alert("LDR Notes saved!");
              }}
            >
              Save
            </button>
          </div>

          {/* Notepad Formatting Toolbar */}
          <div className="notepad-toolbar">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); }}
              className="toolbar-btn"
              title="Bold"
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCmd('italic'); }}
              className="toolbar-btn"
              title="Italic"
            >
              <Italic size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCmd('underline'); }}
              className="toolbar-btn"
              title="Underline"
            >
              <Underline size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }}
              className="toolbar-btn"
              title="Bullet List"
            >
              <List size={14} />
            </button>

            <span className="toolbar-separator"></span>

            {/* Ink Color Picker */}
            <div className="color-picker-group">
              <Palette size={12} className="picker-icon" />
              {['#1d4ed8', '#dc2626', '#0f172a', '#15803d'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); execCmd('foreColor', color); }}
                  className="color-dot"
                  style={{ backgroundColor: color }}
                  title={`Change ink to ${color}`}
                />
              ))}
            </div>

            <span className="toolbar-separator"></span>

            {/* Highlighter Picker */}
            <div className="color-picker-group">
              <Highlighter size={12} className="picker-icon" />
              {['#fef08a', '#fbcfe8', '#bbf7d0', '#ffffff'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); execCmd('backColor', color); }}
                  className="highlight-dot"
                  style={{ backgroundColor: color === '#ffffff' ? 'transparent' : color, border: color === '#ffffff' ? '1px dashed #cbd5e1' : 'none' }}
                  title={color === '#ffffff' ? "Clear highlight" : `Highlight ${color}`}
                />
              ))}
            </div>
          </div>
          
          {/* Spiral Notebook Rings effect */}
          <div className="notepad-spiral-rings">
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
          </div>

          {/* Legal pad paper */}
          <div className="notepad-paper">
            <div
              ref={editorRef}
              className="notepad-textarea content-editable-notepad"
              contentEditable
              {...({ placeholder: "Write your Last Day Revision (LDR) notes here... e.g. key formulas, adjustments to check, or critical questions." } as any)}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
