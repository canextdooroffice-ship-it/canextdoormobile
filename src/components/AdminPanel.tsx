import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Shield, Award, RefreshCw, BookOpen, Edit, Download, Users, Search, Clock } from 'lucide-react';
import { SYLLABUS_DATA } from '../constants/syllabus';
import type { MockTestPaper, MCQQuestion, SubjectiveQuestion } from '../constants/mockTests';
import * as XLSX from 'xlsx';

interface AdminPanelProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  dynamicPapers: MockTestPaper[];
  onRefresh: () => Promise<void>;
  globalSubjects: any[];
  onRefreshGlobalSubjects: () => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  showToast,
  dynamicPapers,
  onRefresh,
  globalSubjects,
  onRefreshGlobalSubjects,
}) => {
  // Sub-navigation state
  const [activeSubTab, setActiveSubTab] = useState<'papers' | 'subjects' | 'users'>('papers');
  
  // User Management states
  const [users, setUsers] = useState<any[]>([]);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);

  // Fetch current session admin id
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentAdminId(session.user.id);
      }
    });
  }, []);

  // Fetch users list from database
  const fetchUsersList = async () => {
    setFetchingUsers(true);
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('user_id, email, full_name, ca_level, total_hours, is_active, updated_at, progress_state')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      showToast(`Failed to fetch users: ${err.message}`, 'error');
    } finally {
      setFetchingUsers(false);
    }
  };

  // Fetch users and subscribe to realtime updates on the user_progress table
  React.useEffect(() => {
    if (activeSubTab !== 'users') return;

    fetchUsersList();

    const channel = supabase
      .channel('user_progress_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_progress' },
        (payload) => {
          console.log('Realtime change in user_progress table:', payload);
          fetchUsersList();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSubTab]);

  const handleToggleUserStatus = async (userId: string, fullName: string, currentStatus: boolean) => {
    if (userId === currentAdminId) {
      showToast('You cannot deactivate your own administrator account!', 'warning');
      return;
    }

    const actionText = currentStatus ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionText} the account of ${fullName || 'this student'}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_progress')
        .update({ is_active: !currentStatus })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, is_active: !currentStatus } : u))
      );
      showToast(`Account of ${fullName || 'student'} ${!currentStatus ? 'activated' : 'deactivated'} successfully!`, 'success');
    } catch (err: any) {
      showToast(`Failed to update account status: ${err.message}`, 'error');
    }
  };

  // Form levels
  const [level, setLevel] = useState<'Foundation' | 'Intermediate' | 'Final'>('Intermediate');
  
  // State for creating new subjects
  const [newSubLevel, setNewSubLevel] = useState<'Foundation' | 'Intermediate' | 'Final'>('Intermediate');
  const [newSubName, setNewSubName] = useState('');
  const [newSubChapters, setNewSubChapters] = useState('');
  const [submittingSubject, setSubmittingSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);

  // Available subjects based on syllabus (dynamically synced when globalSubjects updates)
  const subjects = useMemo(() => {
    return Object.keys(SYLLABUS_DATA[level] || {});
  }, [level, globalSubjects]);

  const [subject, setSubject] = useState(subjects[0] || '');

  // Keep subject updated when level changes
  React.useEffect(() => {
    setSubject(subjects[0] || '');
  }, [subjects]);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'MCQ' | 'Subjective'>('MCQ');
  const [totalMarks, setTotalMarks] = useState<number>(100);

  // Question builder states
  const [qText, setQText] = useState('');
  
  // MCQ specific states
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctIdx, setCorrectIdx] = useState<number>(0);
  const [explanation, setExplanation] = useState('');

  // Subjective specific states
  const [qMarks, setQMarks] = useState<number>(10);
  const [suggestedAnswer, setSuggestedAnswer] = useState('');

  // Built questions list
  const [builtQuestions, setBuiltQuestions] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  // Add question to paper
  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qText.trim()) {
      showToast('Question text cannot be empty', 'error');
      return;
    }

    const newId = `q-${Date.now()}`;

    if (type === 'MCQ') {
      if (!optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) {
        showToast('All options must be filled', 'error');
        return;
      }
      const newQ: MCQQuestion = {
        id: newId,
        question: qText.trim(),
        options: [optA.trim(), optB.trim(), optC.trim(), optD.trim()],
        correctAnswerIndex: correctIdx,
        explanation: explanation.trim() || 'No explanation provided.',
      };
      setBuiltQuestions((prev) => [...prev, newQ]);
      
      // Clear question builder fields
      setQText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setCorrectIdx(0);
      setExplanation('');
    } else {
      const newQ: SubjectiveQuestion = {
        id: newId,
        question: qText.trim(),
        marks: qMarks,
        suggestedAnswer: suggestedAnswer.trim() || 'No suggested answer provided.',
      };
      setBuiltQuestions((prev) => [...prev, newQ]);

      // Clear question builder fields
      setQText('');
      setQMarks(10);
      setSuggestedAnswer('');
    }

    showToast('Question added to paper drafting list', 'success');
  };

  const handleRemoveQuestion = (idx: number) => {
    setBuiltQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  // Upload dynamic paper to Supabase
  const handleUploadPaper = async () => {
    if (!title.trim()) {
      showToast('Paper title cannot be empty', 'error');
      return;
    }
    if (builtQuestions.length === 0) {
      showToast('Please add at least one question to the paper', 'error');
      return;
    }

    setUploading(true);

    try {
      const { error } = await supabase.from('mock_papers').insert({
        level,
        subject,
        title: title.trim(),
        type,
        total_marks: totalMarks,
        questions: builtQuestions,
      });

      if (error) throw error;

      showToast('Test Paper uploaded successfully and broadcasted in real-time!', 'success');
      setTitle('');
      setBuiltQuestions([]);
      await onRefresh();
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    if (!window.confirm('Are you sure you want to delete this custom test paper?')) return;
    try {
      const { error } = await supabase.from('mock_papers').delete().eq('id', paperId);
      if (error) throw error;
      showToast('Test paper deleted successfully', 'success');
      await onRefresh();
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) {
      showToast('Subject name cannot be empty', 'error');
      return;
    }

    setSubmittingSubject(true);

    try {
      // Parse comma-separated chapters
      const parsedChapters = newSubChapters
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (editingSubject) {
        // Update existing subject
        const { error } = await supabase
          .from('global_subjects')
          .update({
            level: newSubLevel,
            name: newSubName.trim(),
            chapters: parsedChapters,
          })
          .eq('id', editingSubject.id);

        if (error) throw error;

        showToast('Global subject updated successfully and broadcasted in real-time!', 'success');
        setEditingSubject(null);
      } else {
        // Insert new subject
        const { error } = await supabase.from('global_subjects').insert({
          level: newSubLevel,
          name: newSubName.trim(),
          chapters: parsedChapters,
        });

        if (error) throw error;

        showToast('Global subject created successfully and broadcasted in real-time!', 'success');
      }

      setNewSubName('');
      setNewSubChapters('');
      await onRefreshGlobalSubjects();
    } catch (err: any) {
      showToast(`Failed to save subject: ${err.message}`, 'error');
    } finally {
      setSubmittingSubject(false);
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the subject "${name}"? All students will lose access to it.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('global_subjects').delete().eq('id', id);
      if (error) throw error;

      showToast(`Subject "${name}" deleted successfully`, 'success');
      await onRefreshGlobalSubjects();
    } catch (err: any) {
      showToast(`Failed to delete subject: ${err.message}`, 'error');
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Question': 'Which of the following section of the Companies Act, 2013 deals with the declaration of dividend?',
        'Option A': 'Section 123',
        'Option B': 'Section 124',
        'Option C': 'Section 125',
        'Option D': 'Section 126',
        'Correct Option': 'A',
        'Explanation': 'Section 123 of the Companies Act, 2013 contains the provisions regarding declaration and payment of dividend.'
      },
      {
        'Question': 'Sample question 2 text goes here. Keep it concise.',
        'Option A': 'Option A description',
        'Option B': 'Option B description',
        'Option C': 'Option C description',
        'Option D': 'Option D description',
        'Correct Option': 'B',
        'Explanation': 'Explanation for option B being correct goes here.'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MCQ Template');

    XLSX.writeFile(workbook, 'CA_Next_Door_MCQ_Template.xlsx');
    showToast('MCQ Excel template downloaded successfully!', 'success');
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Could not read file data');

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error('Excel sheet is empty');

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json<any>(worksheet);

        if (rawJson.length === 0) {
          throw new Error('No question rows found in the sheet');
        }

        const newQuestions: MCQQuestion[] = [];
        let skippedRows = 0;

        rawJson.forEach((row: any, idx: number) => {
          const getVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              keys.some(key => k.trim().toLowerCase() === key.toLowerCase())
            );
            return foundKey ? String(row[foundKey]).trim() : '';
          };

          const questionText = getVal(['Question', 'question', 'QText', 'Q Text']);
          const optAVal = getVal(['Option A', 'option a', 'opt a', 'opta']);
          const optBVal = getVal(['Option B', 'option b', 'opt b', 'optb']);
          const optCVal = getVal(['Option C', 'option c', 'opt c', 'optc']);
          const optDVal = getVal(['Option D', 'option d', 'opt d', 'optd']);
          const correctOptStr = getVal(['Correct Option', 'correct option', 'correct ans', 'ans', 'correct']);
          const explVal = getVal(['Explanation', 'explanation', 'expl', 'exp']);

          if (!questionText || !optAVal || !optBVal || !optCVal || !optDVal || !correctOptStr) {
            skippedRows++;
            return;
          }

          const letter = correctOptStr.toUpperCase().replace(/[^A-D0-3]/g, '').trim();
          let correctIdx = 0;
          if (letter === 'A') correctIdx = 0;
          else if (letter === 'B') correctIdx = 1;
          else if (letter === 'C') correctIdx = 2;
          else if (letter === 'D') correctIdx = 3;
          else {
            const num = parseInt(letter, 10);
            if (num >= 0 && num <= 3) correctIdx = num;
            else {
              skippedRows++;
              return;
            }
          }

          newQuestions.push({
            id: `q-excel-${Date.now()}-${idx}`,
            question: questionText,
            options: [optAVal, optBVal, optCVal, optDVal],
            correctAnswerIndex: correctIdx,
            explanation: explVal || 'No explanation provided.'
          });
        });

        if (newQuestions.length === 0) {
          throw new Error('No valid MCQ questions found. Make sure all columns (Question, Option A, Option B, Option C, Option D, Correct Option) are filled.');
        }

        setBuiltQuestions(prev => [...prev, ...newQuestions]);
        
        if (skippedRows > 0) {
          showToast(`Imported ${newQuestions.length} MCQs (skipped ${skippedRows} invalid rows).`, 'warning');
        } else {
          showToast(`Imported ${newQuestions.length} MCQs successfully!`, 'success');
        }

        e.target.value = '';
      } catch (err: any) {
        showToast(`Excel parsing failed: ${err.message}`, 'error');
        e.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="admin-panel-container fade-in">
      {/* Admin Title Header */}
      <div className="welcome-banner" style={{ marginTop: '8px', marginBottom: '16px' }}>
        <div>
          <span className="level-badge" style={{ backgroundColor: 'var(--accent-red)', color: 'white' }}>
            <Shield size={10} style={{ marginRight: '4px' }} />
            Administrator Panel
          </span>
          <h2 className="welcome-title">
            {activeSubTab === 'papers' && 'Manage Mock Papers'}
            {activeSubTab === 'subjects' && 'Manage Global Subjects'}
            {activeSubTab === 'users' && 'User Management'}
          </h2>
          <p className="welcome-subtitle">
            {activeSubTab === 'papers' && 'Create, publish, and sync exam test materials in real-time.'}
            {activeSubTab === 'subjects' && 'Define and update CA course syllabus structures globally.'}
            {activeSubTab === 'users' && 'Monitor active student progress and control account access.'}
          </p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="segmented-selector-pill" style={{ marginBottom: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '4px', gap: '4px' }}>
        <button
          type="button"
          className={`selector-pill-btn ${activeSubTab === 'papers' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('papers')}
          style={{ flex: 1 }}
        >
          <Award size={14} className="pill-icon" />
          <span>Mock Papers</span>
        </button>
        <button
          type="button"
          className={`selector-pill-btn ${activeSubTab === 'subjects' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('subjects')}
          style={{ flex: 1 }}
        >
          <BookOpen size={14} className="pill-icon" />
          <span>Global Subjects</span>
        </button>
        <button
          type="button"
          className={`selector-pill-btn ${activeSubTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('users')}
          style={{ flex: 1 }}
        >
          <Users size={14} className="pill-icon" />
          <span>User Management</span>
        </button>
      </div>

      {/* Manage Global Subjects Section */}
      {activeSubTab === 'subjects' && (
        <div className="profile-section-card mb-4" style={{ marginBottom: '16px' }}>
          <div className="profile-section-header green">
            <div className="section-icon-badge green">
              <BookOpen size={18} />
            </div>
            <h3 className="section-header-title">{editingSubject ? 'Edit Global Subject' : 'Manage Global Subjects'}</h3>
          </div>

          <div className="admin-upload-form mt-3">
            <form onSubmit={handleCreateSubject}>
              <div className="input-group">
                <label>Course Level</label>
                <div className="test-header-select-wrapper w-full">
                  <select
                    value={newSubLevel}
                    onChange={(e: any) => setNewSubLevel(e.target.value)}
                    className="test-header-level-select w-full"
                    style={{ width: '100%' }}
                  >
                    <option value="Foundation">CA Foundation</option>
                    <option value="Intermediate">CA Intermediate</option>
                    <option value="Final">CA Final</option>
                  </select>
                </div>
              </div>

              <div className="input-group mt-3">
                <label>Subject Name</label>
                <input
                  type="text"
                  placeholder="e.g. Paper 6: Strategic Cost Management"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="styled-task-input"
                />
              </div>

              <div className="input-group mt-3">
                <label>Chapters (Comma-separated)</label>
                <textarea
                  placeholder="Chapter 1, Chapter 2, Chapter 3..."
                  value={newSubChapters}
                  onChange={(e) => setNewSubChapters(e.target.value)}
                  className="styled-task-input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
                <span className="text-[10px] text-slate-400 mt-1 block" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Provide chapter names separated by commas. Leave empty for no chapters.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  disabled={submittingSubject || !newSubName.trim()}
                  className="action-button-primary mt-4"
                  style={{ flex: 1, padding: '12px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {submittingSubject ? (
                    <span className="spinner"></span>
                  ) : (
                    <>
                      {editingSubject ? <Edit size={16} /> : <Plus size={16} />}
                      <span>{editingSubject ? 'Save Changes' : 'Add Global Subject'}</span>
                    </>
                  )}
                </button>
                {editingSubject && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSubject(null);
                      setNewSubLevel('Intermediate');
                      setNewSubName('');
                      setNewSubChapters('');
                    }}
                    className="action-button-secondary mt-4"
                    style={{ flex: 1, padding: '12px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List of Custom Subjects */}
          {globalSubjects.length > 0 && (
            <div className="mt-4" style={{ marginTop: '20px' }}>
              <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-2" style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Published Global Subjects ({globalSubjects.length})
              </h4>
              <div className="subject-collapsible-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {globalSubjects.map((sub: any) => (
                  <div key={sub.id} className="paper-row-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                    <div className="paper-row-left" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h4 className="paper-row-title" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                        {sub.name}
                      </h4>
                      <div className="paper-row-badge-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="paper-type-badge mcq" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', border: 'none', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                          {sub.level}
                        </span>
                        <span className="paper-meta-text" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {sub.chapters?.length || 0} Chapters
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubject(sub);
                          setNewSubLevel(sub.level);
                          setNewSubName(sub.name);
                          setNewSubChapters(sub.chapters ? sub.chapters.join(', ') : '');
                          // Scroll to header smoothly
                          const formElem = document.querySelector('.admin-panel-container');
                          if (formElem) {
                            formElem.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="subject-delete-btn"
                        title="Edit Subject"
                        style={{ color: 'var(--accent-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubject(sub.id, sub.name)}
                        className="subject-delete-btn"
                        title="Delete Subject"
                        style={{ color: 'var(--accent-red)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mock Papers Sections */}
      {activeSubTab === 'papers' && (
        <>
          {/* Upload Paper Section */}
          <div className="profile-section-card">
            <div className="profile-section-header purple">
              <div className="section-icon-badge purple">
                <Plus size={18} />
              </div>
              <h3 className="section-header-title">Draft New Test Paper</h3>
            </div>

            <div className="admin-upload-form mt-3">
              <div className="input-group">
                <label>Course Level</label>
                <div className="test-header-select-wrapper w-full">
                  <select
                    value={level}
                    onChange={(e: any) => setLevel(e.target.value)}
                    className="test-header-level-select w-full"
                    style={{ width: '100%' }}
                  >
                    <option value="Foundation">CA Foundation</option>
                    <option value="Intermediate">CA Intermediate</option>
                    <option value="Final">CA Final</option>
                  </select>
                </div>
              </div>

              <div className="input-group mt-3">
                <label>Subject</label>
                <div className="test-header-select-wrapper w-full">
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="test-header-level-select w-full"
                    style={{ width: '100%' }}
                  >
                    {subjects.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input-group mt-3">
                <label>Paper Title</label>
                <input
                  type="text"
                  placeholder="e.g. Accounting Standards Core Practice Paper"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="styled-task-input"
                />
              </div>

              <div className="grid-2-col mt-3" style={{ display: 'flex', gap: '12px' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Paper Type</label>
                  <div className="test-header-select-wrapper w-full">
                    <select
                      value={type}
                      onChange={(e: any) => { setType(e.target.value); setBuiltQuestions([]); }}
                      className="test-header-level-select w-full"
                      style={{ width: '100%' }}
                    >
                      <option value="MCQ">MCQ (Objective)</option>
                      <option value="Subjective">Subjective (Theory)</option>
                    </select>
                  </div>
                </div>

                <div className="input-group" style={{ flex: 1 }}>
                  <label>Total Marks</label>
                  <input
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(parseInt(e.target.value, 10) || 0)}
                    className="styled-task-input"
                  />
                </div>
              </div>

              {/* Bulk MCQ Excel Upload Section */}
              {type === 'MCQ' && (
                <div className="mt-4 p-3 border border-slate-200 dark:border-slate-800 rounded-xl" style={{ border: '1.5px dashed var(--border-color)', padding: '16px', borderRadius: '16px', marginTop: '16px', backgroundColor: 'rgba(34, 197, 94, 0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <BookOpen size={16} style={{ color: 'var(--accent-secondary)' }} />
                    <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Bulk Upload MCQs via Excel
                    </h4>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                    Download our standardized Excel template, fill in your multiple choice questions, options, correct answers, and explanations, then upload it to import all questions in one go.
                  </p>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="action-button-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 12px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                      <Download size={14} />
                      <span>Download Excel Template</span>
                    </button>

                    <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                      <button
                        type="button"
                        className="action-button-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 12px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                      >
                        <Plus size={14} />
                        <span>Upload Excel File</span>
                      </button>
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleExcelUpload}
                        style={{ position: 'absolute', fontSize: '100px', left: 0, top: 0, opacity: 0, cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Builder Form */}
              <div className="question-builder-box mt-4 p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/10">
                <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-3">
                  Question Builder ({type} Mode)
                </h4>

                <form onSubmit={handleAddQuestion}>
                  <div className="input-group">
                    <label>Question Text</label>
                    <textarea
                      placeholder="Enter descriptive or objective question text..."
                      value={qText}
                      onChange={(e) => setQText(e.target.value)}
                      className="styled-task-input"
                      rows={2}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  {type === 'MCQ' ? (
                    <>
                      <div className="grid-2-col mt-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div className="input-group">
                          <label>Option A</label>
                          <input
                            type="text"
                            placeholder="Option A"
                            value={optA}
                            onChange={(e) => setOptA(e.target.value)}
                            className="styled-task-input"
                          />
                        </div>
                        <div className="input-group">
                          <label>Option B</label>
                          <input
                            type="text"
                            placeholder="Option B"
                            value={optB}
                            onChange={(e) => setOptB(e.target.value)}
                            className="styled-task-input"
                          />
                        </div>
                      </div>

                      <div className="grid-2-col mt-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div className="input-group">
                          <label>Option C</label>
                          <input
                            type="text"
                            placeholder="Option C"
                            value={optC}
                            onChange={(e) => setOptC(e.target.value)}
                            className="styled-task-input"
                          />
                        </div>
                        <div className="input-group">
                          <label>Option D</label>
                          <input
                            type="text"
                            placeholder="Option D"
                            value={optD}
                            onChange={(e) => setOptD(e.target.value)}
                            className="styled-task-input"
                          />
                        </div>
                      </div>

                      <div className="input-group mt-3">
                        <label>Correct Option</label>
                        <div className="test-header-select-wrapper w-full">
                          <select
                            value={correctIdx}
                            onChange={(e) => setCorrectIdx(parseInt(e.target.value, 10))}
                            className="test-header-level-select w-full"
                            style={{ width: '100%' }}
                          >
                            <option value={0}>Option A</option>
                            <option value={1}>Option B</option>
                            <option value={2}>Option C</option>
                            <option value={3}>Option D</option>
                          </select>
                        </div>
                      </div>

                      <div className="input-group mt-3">
                        <label>Explanation / Answer Rationale</label>
                        <textarea
                          placeholder="Explain why the option is correct..."
                          value={explanation}
                          onChange={(e) => setExplanation(e.target.value)}
                          className="styled-task-input"
                          rows={2}
                          style={{ resize: 'vertical' }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="input-group mt-3">
                        <label>Question Marks</label>
                        <input
                          type="number"
                          value={qMarks}
                          onChange={(e) => setQMarks(parseInt(e.target.value, 10) || 0)}
                          className="styled-task-input"
                        />
                      </div>

                      <div className="input-group mt-3">
                        <label>Suggested Answer / Marking Key</label>
                        <textarea
                          placeholder="Outline key points or full solution..."
                          value={suggestedAnswer}
                          onChange={(e) => setSuggestedAnswer(e.target.value)}
                          className="styled-task-input"
                          rows={3}
                          style={{ resize: 'vertical' }}
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    className="action-button-secondary mt-3 w-full"
                  >
                    <Plus size={16} />
                    <span>Add Question to Draft</span>
                  </button>
                </form>
              </div>

              {/* Draft review */}
              {builtQuestions.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-2">
                    Drafted Questions ({builtQuestions.length})
                  </h4>
                  <div className="draft-questions-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {builtQuestions.map((q, idx) => (
                      <div key={q.id || idx} className="paper-row-card" style={{ padding: '10px 14px' }}>
                        <div className="paper-row-left" style={{ gap: '4px' }}>
                          <span className="font-bold text-xs text-slate-500">Q{idx + 1}.</span>
                          <p className="paper-row-title" style={{ fontSize: '12px' }}>{q.question}</p>
                          <span className="text-[10px] text-slate-400">
                            {type === 'MCQ' 
                              ? `Options: ${q.options.join(' | ')} (Correct: ${String.fromCharCode(65 + q.correctAnswerIndex)})`
                              : `Weight: ${q.marks} Marks`
                            }
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(idx)}
                          className="subject-delete-btn"
                          title="Remove Question"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Upload button */}
              <button
                type="button"
                onClick={handleUploadPaper}
                disabled={uploading || builtQuestions.length === 0}
                className="action-button-primary mt-4 w-full"
                style={{ padding: '12px' }}
              >
                {uploading ? (
                  <span className="spinner"></span>
                ) : (
                  <>
                    <Award size={16} />
                    <span>Publish Test Paper (Broadcast Sync)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Dynamic Uploads List */}
          <div className="profile-section-card mt-3 mb-5">
            <div className="profile-section-header cyan" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="section-icon-badge cyan">
                  <BookOpen size={18} />
                </div>
                <h3 className="section-header-title">Published Dynamic Papers ({dynamicPapers.length})</h3>
              </div>
              <button 
                type="button" 
                onClick={onRefresh} 
                className="subject-delete-btn" 
                title="Refresh database records"
                style={{ color: 'var(--accent-secondary)' }}
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="subject-collapsible-list mt-3">
              {dynamicPapers.length === 0 ? (
                <p className="no-papers-msg">No dynamic papers published yet. Use the draft form above to create one.</p>
              ) : (
                dynamicPapers.map((paper: any) => (
                  <div key={paper.id} className="paper-row-card">
                    <div className="paper-row-left">
                      <h4 className="paper-row-title">{paper.title}</h4>
                      <div className="paper-row-badge-row">
                        <span className={`paper-type-badge ${paper.type === 'MCQ' ? 'mcq' : 'subjective'}`}>
                          {paper.type}
                        </span>
                        <span className="paper-meta-text">
                          {paper.level} • {paper.subject} • {paper.questions?.length || 0} Qs
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePaper(paper.id)}
                      className="subject-delete-btn"
                      title="Delete Paper"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* User Management Section */}
      {activeSubTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="mb-5">
          {/* Stats Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div className="profile-section-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', margin: 0, border: '1px solid var(--border-color)', borderRadius: '16px', backgroundColor: 'var(--bg-card)' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Students</span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{users.length}</span>
            </div>
            <div className="profile-section-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', margin: 0, border: '1px solid var(--border-color)', borderRadius: '16px', backgroundColor: 'var(--bg-card)' }}>
              <span style={{ fontSize: '10px', color: 'var(--accent-green)', fontWeight: 'bold', textTransform: 'uppercase' }}>Active</span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent-green)' }}>
                {users.filter(u => u.is_active !== false).length}
              </span>
            </div>
            <div className="profile-section-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', margin: 0, border: '1px solid var(--border-color)', borderRadius: '16px', backgroundColor: 'var(--bg-card)' }}>
              <span style={{ fontSize: '10px', color: 'var(--accent-red)', fontWeight: 'bold', textTransform: 'uppercase' }}>Blocked</span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent-red)' }}>
                {users.filter(u => u.is_active === false).length}
              </span>
            </div>
          </div>

          {/* Search Bar & Refresh Row */}
          <div className="profile-section-card" style={{ padding: '12px', margin: 0, border: '1px solid var(--border-color)', borderRadius: '16px', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={fetchUsersList}
                disabled={fetchingUsers}
                className="subject-delete-btn"
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '38px',
                  height: '38px'
                }}
                title="Refresh users list"
              >
                <RefreshCw size={16} style={{ animation: fetchingUsers ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>

          {/* Users List Card */}
          <div className="profile-section-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)', borderRadius: '16px', backgroundColor: 'var(--bg-card)' }}>
            <div className="profile-section-header green" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="section-icon-badge green">
                  <Users size={18} />
                </div>
                <h3 className="section-header-title">Student Directory</h3>
              </div>
            </div>

            {fetchingUsers ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px 0' }}>
                <span className="spinner"></span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {users.filter(u => {
                  const query = userSearch.toLowerCase().trim();
                  if (!query) return true;
                  const rawProgress = u.progress_state as any;
                  let name = (u.full_name || rawProgress?.fullName || '').trim();
                  name = name.replace(/^['"]|['"]$/g, '').trim();
                  if (!name || name === '""' || name === "''") {
                    name = 'anonymous student';
                  }
                  const email = u.email || `student id: ${u.user_id.substring(0, 8)}`;
                  return (
                    name.toLowerCase().includes(query) ||
                    email.toLowerCase().includes(query)
                  );
                }).length === 0 ? (
                  <p className="no-papers-msg">No students found matching your criteria.</p>
                ) : (
                  users.filter(u => {
                    const query = userSearch.toLowerCase().trim();
                    if (!query) return true;
                    const rawProgress = u.progress_state as any;
                    let name = (u.full_name || rawProgress?.fullName || '').trim();
                    name = name.replace(/^['"]|['"]$/g, '').trim();
                    if (!name || name === '""' || name === "''") {
                      name = 'anonymous student';
                    }
                    const email = u.email || `student id: ${u.user_id.substring(0, 8)}`;
                    return (
                      name.toLowerCase().includes(query) ||
                      email.toLowerCase().includes(query)
                    );
                  }).map((u) => {
                    const rawProgress = u.progress_state as any;
                    
                    let displayName = (u.full_name || rawProgress?.fullName || '').trim();
                    displayName = displayName.replace(/^['"]|['"]$/g, '').trim();
                    if (!displayName || displayName === '""' || displayName === "''") {
                      displayName = 'Anonymous Student';
                    }

                    const displayEmail = u.email || `Student ID: ${u.user_id.substring(0, 8)}`;
                    const isSelf = u.user_id === currentAdminId;
                    const isActive = u.is_active !== false;
                    const initialLetter = displayName.charAt(0).toUpperCase();

                    return (
                      <div
                        key={u.user_id}
                        className="paper-row-card"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '16px',
                          backgroundColor: isActive ? 'var(--bg-secondary)' : 'rgba(239, 68, 68, 0.05)',
                          margin: 0
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          {/* Avatar Circle */}
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: isActive 
                                ? 'linear-gradient(135deg, var(--accent-primary, #6366f1), var(--accent-secondary, #0ea5e9))'
                                : 'linear-gradient(135deg, #94a3b8, #cbd5e1)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '16px',
                              flexShrink: 0
                            }}
                          >
                            {initialLetter}
                          </div>

                          {/* Info Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                                {displayName}
                              </h4>
                              {isSelf && (
                                <span style={{ fontSize: '8px', backgroundColor: 'var(--accent-primary)', color: 'white', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                  You
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayEmail}</span>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                              <span style={{ fontSize: '9px', backgroundColor: 'rgba(99, 102, 241, 0.08)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                                {u.ca_level || 'Intermediate'}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                                <span>{(u.total_hours || 0).toFixed(1)} hrs</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions Toggle switch */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', marginLeft: '12px' }}>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 'bold',
                            color: isActive ? 'var(--accent-green, #10b981)' : 'var(--accent-red, #ef4444)',
                            textTransform: 'uppercase'
                          }}>
                            {isActive ? 'Active' : 'Blocked'}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u.user_id, u.full_name || u.email, isActive)}
                            disabled={isSelf}
                            style={{
                              width: '44px',
                              height: '24px',
                              borderRadius: '12px',
                              backgroundColor: isActive ? 'var(--accent-green, #10b981)' : 'var(--border-color, #e2e8f0)',
                              border: 'none',
                              position: 'relative',
                              cursor: isSelf ? 'not-allowed' : 'pointer',
                              opacity: isSelf ? 0.5 : 1,
                              transition: 'background-color 0.2s ease',
                              padding: 0
                            }}
                          >
                            <div
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: 'white',
                                position: 'absolute',
                                top: '2px',
                                left: isActive ? '22px' : '2px',
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                              }}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
