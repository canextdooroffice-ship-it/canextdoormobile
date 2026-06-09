import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronDown, Plus, Trash2, Calendar, Award, BookOpen, Info, ClipboardList, Check, X, ArrowRight, ArrowLeft, CheckCircle, HelpCircle } from 'lucide-react';
import { SYLLABUS_DATA } from '../constants/syllabus';
import { MOCK_TESTS_DATA } from '../constants/mockTests';
import type { MockTestPaper, MCQQuestion, SubjectiveQuestion } from '../constants/mockTests';
import type { ProgressState } from './Subjects';

export interface TestRecord {
  id: string;
  subjectName: string;
  testName: string;
  date: string;
  marksObtained: number;
  totalMarks: number;
  notes?: string;
}

interface TestProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  caLevel: string;
  onChangeCaLevel: (level: string) => void;
  progressState: ProgressState;
  tests: TestRecord[];
  setTests: React.Dispatch<React.SetStateAction<TestRecord[]>>;
  onBack: () => void;
  dynamicPapers: MockTestPaper[];
}

export const Test: React.FC<TestProps> = ({
  showToast,
  caLevel,
  onChangeCaLevel,
  progressState,
  tests,
  setTests,
  onBack,
  dynamicPapers,
}) => {
  // Get active subjects dynamically based on syllabus data & progressState
  const activeSubjects = useMemo(() => {
    const currentSyllabus = (SYLLABUS_DATA[caLevel as keyof typeof SYLLABUS_DATA] || SYLLABUS_DATA.Intermediate) as Record<string, string[]>;
    const defaultSubs = Object.keys(currentSyllabus);
    return Object.keys(progressState).filter((sub) => {
      const isDefaultCurrent = defaultSubs.includes(sub);
      const isDefaultAny = Object.values(SYLLABUS_DATA).some((levelSyllabus) =>
        Object.keys(levelSyllabus).includes(sub)
      );
      const isCustom = !isDefaultAny;
      return isDefaultCurrent || isCustom;
    });
  }, [caLevel, progressState]);

  // Collapsed subjects for mock test lists
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Manual Logger Form States
  const [showLogForm, setShowLogForm] = useState(false);
  const [subjectName, setSubjectName] = useState(activeSubjects[0] || '');
  const [testName, setTestName] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [marksObtained, setMarksObtained] = useState<number | ''>('');
  const [totalMarks, setTotalMarks] = useState<number | ''>(100);
  const [notes, setNotes] = useState('');

  // Interactive Attempt States
  const [activeTest, setActiveTest] = useState<MockTestPaper | null>(null);
  const [activeTestSubject, setActiveTestSubject] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({}); // question ID -> selected option index
  const [showQuizResults, setShowQuizResults] = useState<boolean>(false);
  const [revealedQuestions, setRevealedQuestions] = useState<Record<string, boolean>>({});
  
  // Subjective Attempt States
  const [showSuggestedAnswers, setShowSuggestedAnswers] = useState<Record<string, boolean>>({});
  const [subjectiveMarks, setSubjectiveMarks] = useState<Record<string, number | ''>>({});
  const [subjectiveNotes, setSubjectiveNotes] = useState('');

  // Stats calculation
  const stats = useMemo(() => {
    const count = tests.length;
    if (count === 0) {
      return { count, averagePercentage: 0, highestScore: 0, highestTestName: 'None' };
    }
    
    let sumPercentage = 0;
    let highestPct = 0;
    let highestName = 'None';
    
    tests.forEach((t) => {
      const pct = (t.marksObtained / t.totalMarks) * 100;
      sumPercentage += pct;
      if (pct > highestPct) {
        highestPct = pct;
        highestName = `${t.subjectName} (${Math.round(pct)}%)`;
      }
    });

    return {
      count,
      averagePercentage: Math.round(sumPercentage / count),
      highestScore: Math.round(highestPct),
      highestTestName: highestName,
    };
  }, [tests]);

  // Sync subject default selection if active subjects list updates
  useEffect(() => {
    if (activeSubjects.length > 0 && !activeSubjects.includes(subjectName)) {
      setSubjectName(activeSubjects[0]);
    }
  }, [activeSubjects, subjectName]);

  const toggleSubjectExpand = (sub: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [sub]: !prev[sub],
    }));
  };

  // Log test score submission handler (Manual)
  const handleLogScoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName) {
      showToast('Please select a subject.', 'warning');
      return;
    }
    if (!testName.trim()) {
      showToast('Please enter a test description or title.', 'warning');
      return;
    }
    if (marksObtained === '' || marksObtained < 0) {
      showToast('Please enter valid marks obtained.', 'warning');
      return;
    }
    if (totalMarks === '' || totalMarks <= 0) {
      showToast('Please enter a valid total marks figure.', 'warning');
      return;
    }
    if (marksObtained > totalMarks) {
      showToast('Marks obtained cannot be higher than total marks.', 'error');
      return;
    }

    const newRecord: TestRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      subjectName,
      testName: testName.trim(),
      date,
      marksObtained,
      totalMarks,
      notes: notes.trim() || undefined,
    };

    setTests((prev) => [newRecord, ...prev]);
    showToast('Mock Test score logged successfully! ✨', 'success');

    // Reset Form
    setTestName('');
    setMarksObtained('');
    setNotes('');
    setShowLogForm(false);
  };

  const handleDeleteRecord = (id: string) => {
    setTests((prev) => prev.filter((t) => t.id !== id));
    showToast('Test record deleted.', 'info');
  };

  // Start Interactive Attempt
  const handleStartAttempt = (paper: MockTestPaper, sub: string) => {
    setActiveTest(paper);
    setActiveTestSubject(sub);
    setCurrentQuestionIndex(0);
    setMcqAnswers({});
    setShowQuizResults(false);
    setRevealedQuestions({});
    setShowSuggestedAnswers({});
    setSubjectiveMarks({});
    setSubjectiveNotes('');
  };

  // Handle MCQ Choice
  const handleSelectMCQOption = (questionId: string, optionIndex: number) => {
    if (showQuizResults) return; // Locked after submission
    setMcqAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  // Submit MCQ Quiz
  const handleSubmitMCQQuiz = () => {
    // Check if all questions are answered
    const questions = activeTest?.questions as MCQQuestion[];
    const unansweredCount = questions.filter((q) => mcqAnswers[q.id] === undefined).length;
    
    if (unansweredCount > 0) {
      const confirmSubmit = window.confirm(`You have ${unansweredCount} unanswered questions. Do you want to submit anyway?`);
      if (!confirmSubmit) return;
    }
    
    setShowQuizResults(true);
    playSuccessSound();
    showToast('Quiz submitted! Check your results below. 📊', 'success');
  };

  // Synthesize success sound chime
  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.1 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.4);
      });
    } catch { /* ignore */ }
  };

  // Save MCQ Score to History
  const handleSaveMCQScore = () => {
    if (!activeTest) return;
    const questions = activeTest.questions as MCQQuestion[];
    
    // Calculate correct answers
    let correctCount = 0;
    questions.forEach((q) => {
      if (mcqAnswers[q.id] === q.correctAnswerIndex && !revealedQuestions[q.id]) {
        correctCount++;
      }
    });

    const weightPerQuestion = activeTest.totalMarks / questions.length;
    const finalScore = parseFloat((correctCount * weightPerQuestion).toFixed(1));

    const today = new Date().toISOString().split('T')[0];
    const revealedCount = questions.filter((q) => revealedQuestions[q.id]).length;
    const notesStr = `MCQ Score: ${correctCount}/${questions.length} correct answers.${revealedCount > 0 ? ` (${revealedCount} answers revealed, disqualified for marks).` : ''}`;

    const newRecord: TestRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      subjectName: activeTestSubject,
      testName: activeTest.title,
      date: today,
      marksObtained: finalScore,
      totalMarks: activeTest.totalMarks,
      notes: notesStr,
    };

    setTests((prev) => [newRecord, ...prev]);
    showToast('MCQ attempt logged successfully! ✨', 'success');
    
    // Exit Quiz View
    setActiveTest(null);
  };

  // Toggle suggested answers
  const toggleSuggestedAnswer = (questionId: string) => {
    setShowSuggestedAnswers((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // Set subjective individual question mark
  const handleSetSubjectiveMark = (questionId: string, score: number) => {
    setSubjectiveMarks((prev) => ({
      ...prev,
      [questionId]: score,
    }));
  };

  // Save Subjective Score to History
  const handleSaveSubjectiveScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTest) return;
    const questions = activeTest.questions as SubjectiveQuestion[];
    
    let sumObtained = 0;
    let missingMark = false;
    
    questions.forEach((q) => {
      const score = subjectiveMarks[q.id];
      if (score === undefined || score === '') {
        missingMark = true;
      } else {
        sumObtained += score;
      }
    });

    if (missingMark) {
      showToast('Please grade all questions before logging the score.', 'warning');
      return;
    }

    if (sumObtained > activeTest.totalMarks) {
      showToast('Sum of grades cannot exceed total paper marks.', 'error');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const newRecord: TestRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      subjectName: activeTestSubject,
      testName: activeTest.title,
      date: today,
      marksObtained: sumObtained,
      totalMarks: activeTest.totalMarks,
      notes: subjectiveNotes.trim() ? `Self-Evaluation Notes: ${subjectiveNotes.trim()}` : 'Self-Evaluated Descriptive Paper.',
    };

    setTests((prev) => [newRecord, ...prev]);
    showToast('Descriptive Paper attempt logged successfully! ✨', 'success');
    
    // Exit View
    setActiveTest(null);
  };

  // MCQ score calculation helper
  const activeTestMCQScore = useMemo(() => {
    if (!activeTest || activeTest.type !== 'MCQ') return 0;
    const questions = activeTest.questions as MCQQuestion[];
    let correctCount = 0;
    questions.forEach((q) => {
      if (mcqAnswers[q.id] === q.correctAnswerIndex && !revealedQuestions[q.id]) {
        correctCount++;
      }
    });
    return correctCount;
  }, [activeTest, mcqAnswers, revealedQuestions]);

  // Check if a test has been attempted in log history
  const getTestLogStatus = (sub: string, title: string) => {
    return tests.find((t) => t.subjectName === sub && t.testName === title);
  };

  // Render the interactive workspace
  if (activeTest) {
    const isMCQ = activeTest.type === 'MCQ';
    const totalQuestions = activeTest.questions.length;
    const progressPct = isMCQ 
      ? Math.round((Object.keys(mcqAnswers).length / totalQuestions) * 100)
      : 100;

    return (
      <div className="test-attempt-workspace fade-in">
        {/* Header Bar */}
        <div className="test-header-bar">
          <button 
            type="button" 
            onClick={() => {
              if (window.confirm('Are you sure you want to exit? Your current attempt progress will be lost.')) {
                setActiveTest(null);
              }
            }} 
            className="test-back-btn"
          >
            <ChevronLeft size={20} />
            <span>Quit Attempt</span>
          </button>
          <span className="test-header-title-text truncate max-w-[200px]">
            {activeTest.title}
          </span>
        </div>

        {/* Info card */}
        <div className="profile-section-card mt-3">
          <div className="test-workspace-meta-row">
            <span className="workspace-subject-badge">{activeTestSubject}</span>
            <span className={`workspace-type-badge ${isMCQ ? 'mcq' : 'subj'}`}>
              {activeTest.type}
            </span>
            <span className="workspace-marks-badge">{activeTest.totalMarks} Marks</span>
          </div>
        </div>

        {/* MCQ Interactive Workspace */}
        {isMCQ && (
          <div className="mcq-attempt-area mt-4">
            {!showQuizResults ? (
              <>
                {/* Question Carousel Card */}
                <div className="profile-section-card relative overflow-hidden">
                  <div className="mcq-progress-bar-wrap">
                    <div className="mcq-progress-bar-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  
                  <div className="question-card-header-row pt-2">
                    <span className="question-number-indicator">
                      Question {currentQuestionIndex + 1} of {totalQuestions}
                    </span>
                    <span className="question-points-badge">
                      {parseFloat((activeTest.totalMarks / totalQuestions).toFixed(1))} M
                    </span>
                  </div>

                  <div className="question-body-text mt-3">
                    {(activeTest.questions as MCQQuestion[])[currentQuestionIndex].question}
                  </div>

                  {/* Options List */}
                  <div className="mcq-options-container mt-4">
                    {(activeTest.questions as MCQQuestion[])[currentQuestionIndex].options.map((opt, oIdx) => {
                      const currentQuestion = (activeTest.questions as MCQQuestion[])[currentQuestionIndex];
                      const qId = currentQuestion.id;
                      const isSelected = mcqAnswers[qId] === oIdx;
                      const isRevealed = !!revealedQuestions[qId];
                      const isCorrectOption = oIdx === currentQuestion.correctAnswerIndex;

                      let optionClass = `mcq-option-button`;
                      if (isSelected) optionClass += ' active';
                      if (isRevealed) {
                        if (isCorrectOption) optionClass += ' reveal-correct';
                        else if (isSelected) optionClass += ' reveal-incorrect';
                        optionClass += ' disabled';
                      }

                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => !isRevealed && handleSelectMCQOption(qId, oIdx)}
                          className={optionClass}
                          disabled={isRevealed}
                        >
                          <span className="option-letter">
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="option-text">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Reveal Answer Action */}
                  <div className="mcq-reveal-action-block">
                    {(() => {
                      const currentQuestion = (activeTest.questions as MCQQuestion[])[currentQuestionIndex];
                      const qId = currentQuestion.id;
                      const isRevealed = !!revealedQuestions[qId];

                      if (!isRevealed) {
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to reveal the answer? This question will be marked as 0 points.")) {
                                setRevealedQuestions(prev => ({ ...prev, [qId]: true }));
                              }
                            }}
                            className="attempt-delete-action-btn danger"
                          >
                            <HelpCircle size={14} />
                            <span>Reveal Answer (Disqualifies Marks)</span>
                          </button>
                        );
                      }

                      return (
                        <div className="w-full slide-up">
                          <div className="explanation-badge incorrect revealed-badge">
                            <X size={12} />
                            <span>Answer Revealed (0 Marks Obtained)</span>
                          </div>
                          <div className="explanation-reason-box">
                            <HelpCircle size={14} className="explanation-reason-icon" />
                            <p className="explanation-reason-text">{currentQuestion.explanation}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Navigation Carousel controls */}
                <div className="mcq-carousel-controls-row mt-4">
                  <button
                    type="button"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                    className="carousel-nav-btn"
                  >
                    <ArrowLeft size={16} />
                    <span>Previous</span>
                  </button>

                  {currentQuestionIndex < totalQuestions - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                      className="carousel-nav-btn next"
                    >
                      <span>Next</span>
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmitMCQQuiz}
                      className="carousel-nav-btn submit"
                    >
                      <CheckCircle size={16} />
                      <span>Submit Quiz</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* MCQ Quiz Evaluation Results View */
              <div className="quiz-results-view slide-up">
                <div className="profile-section-card text-center">
                  <div className="results-gauge-wrap mx-auto">
                    <div className="results-percentage-num">
                      {Math.round((activeTestMCQScore / totalQuestions) * 100)}%
                    </div>
                    <div className="results-fraction-lbl">
                      {activeTestMCQScore} / {totalQuestions} Correct
                    </div>
                  </div>
                  <h3 className="results-summary-title mt-3">Attempt Completed!</h3>
                  <p className="results-summary-desc">
                    You scored <strong>{parseFloat((activeTestMCQScore * (activeTest.totalMarks / totalQuestions)).toFixed(1))}</strong> out of {activeTest.totalMarks} marks.
                  </p>

                  <div className="results-action-buttons-row mt-4">
                    <button
                      type="button"
                      onClick={handleSaveMCQScore}
                      className="action-button-primary"
                    >
                      <CheckCircle size={16} />
                      <span>Save Score to Logs</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTest(null)}
                      className="action-button-secondary mt-2"
                    >
                      Discard & Exit
                    </button>
                  </div>
                </div>

                {/* Explanation Breakdown List */}
                <h3 className="section-title mt-5">Question Review</h3>
                <div className="results-explanations-list mt-3">
                  {(activeTest.questions as MCQQuestion[]).map((q, idx) => {
                    const selectedIdx = mcqAnswers[q.id];
                    const isRevealed = !!revealedQuestions[q.id];
                    const isCorrect = selectedIdx === q.correctAnswerIndex && !isRevealed;
                    
                    let cardClass = `explanation-card mt-3`;
                    if (isRevealed) cardClass += ' revealed';
                    else if (isCorrect) cardClass += ' correct';
                    else cardClass += ' incorrect';
                    
                    return (
                      <div key={q.id} className={cardClass}>
                        <div className="explanation-header-row">
                          <span className="explanation-q-num">Q{idx + 1}</span>
                          {isRevealed ? (
                            <div className="explanation-badge incorrect">
                              <X size={12} />
                              <span>Answer Revealed (0 M)</span>
                            </div>
                          ) : (
                            <div className={`explanation-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
                              {isCorrect ? <Check size={12} /> : <X size={12} />}
                              <span>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                            </div>
                          )}
                        </div>

                        <p className="explanation-question-text mt-2">{q.question}</p>
                        
                        <div className="explanation-choices-review mt-3">
                          <div className="choice-review-item">
                            <strong>Your Answer:</strong>{' '}
                            {selectedIdx !== undefined 
                              ? `${String.fromCharCode(65 + selectedIdx)}. ${q.options[selectedIdx]}`
                              : 'None (Skipped)'}
                          </div>
                          {!isCorrect && (
                            <div className="choice-review-item correct mt-1">
                              <strong>Correct Answer:</strong>{' '}
                              {`${String.fromCharCode(65 + q.correctAnswerIndex)}. ${q.options[q.correctAnswerIndex]}`}
                            </div>
                          )}
                        </div>

                        <div className="explanation-reason-box mt-3">
                          <HelpCircle size={14} className="explanation-reason-icon" />
                          <p className="explanation-reason-text">{q.explanation}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Subjective Interactive Workspace */}
        {!isMCQ && (
          <div className="subjective-attempt-area mt-4">
            <h3 className="section-title">Question Paper</h3>
            <p className="welcome-subtitle mb-3">Solve the questions below on paper, then toggle to view suggested answers & mark your score.</p>
            
            <div className="subjective-questions-list">
              {(activeTest.questions as SubjectiveQuestion[]).map((q, idx) => {
                const showAnswer = !!showSuggestedAnswers[q.id];
                const currentMark = subjectiveMarks[q.id] ?? '';
                
                return (
                  <div key={q.id} className="profile-section-card mt-3">
                    <div className="explanation-header-row">
                      <span className="explanation-q-num">Question {idx + 1}</span>
                      <span className="question-points-badge">{q.marks} Marks</span>
                    </div>

                    <p className="explanation-question-text mt-3" style={{ fontSize: '14px', lineHeight: '1.4' }}>
                      {q.question}
                    </p>

                    <button
                      type="button"
                      onClick={() => toggleSuggestedAnswer(q.id)}
                      className="ldrs-btn mt-3 w-full"
                    >
                      <BookOpen size={12} />
                      <span>{showAnswer ? 'Hide suggested answer' : 'Show suggested answer'}</span>
                    </button>

                    {showAnswer && (
                      <div className="attempt-card-notes mt-2 border-l-3 border-[#0ea5e9]">
                        <strong>Suggested Marking Scheme & Solution:</strong>
                        <p className="mt-1 whitespace-pre-line text-xs">{q.suggestedAnswer}</p>
                      </div>
                    )}

                    {/* Individual Question Self-Grading */}
                    <div className="individual-grading-row mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Self-Evaluation Mark (Out of {q.marks})
                      </label>
                      <div className="form-priority-btn-group mt-2">
                        {Array.from({ length: q.marks + 1 }).map((_, val) => {
                          const isSelected = currentMark === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleSetSubjectiveMark(q.id, val)}
                              className={`form-priority-btn C ${isSelected ? 'active' : ''}`}
                              style={{ flex: 1, minWidth: '32px' }}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Overall Descriptive Paper Submission Form */}
            <form onSubmit={handleSaveSubjectiveScore} className="profile-section-card mt-4">
              <div className="profile-section-header purple">
                <div className="section-icon-badge purple">
                  <Award size={18} />
                </div>
                <h3 className="section-header-title">Log Descriptive Score</h3>
              </div>

              <div className="input-group mt-3">
                <label>Review Notes / Key Areas of Improvement</label>
                <textarea
                  placeholder="Notes on mistakes made, structural weaknesses, timing, etc."
                  value={subjectiveNotes}
                  onChange={(e) => setSubjectiveNotes(e.target.value)}
                  className="styled-task-input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="profile-action-buttons-row mt-4">
                <button type="submit" className="profile-save-btn">
                  Save Descriptive Score
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to discard your evaluation?')) {
                      setActiveTest(null);
                    }
                  }}
                  className="profile-cancel-btn"
                >
                  Discard
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Render the tests list and stats summary (Normal view)
  return (
    <div className="test-redesign-container fade-in">
      {/* Header bar */}
      <div className="test-header-bar">
        <button type="button" onClick={onBack} className="test-back-btn">
          <ChevronLeft size={20} />
          <span>Subjects</span>
        </button>
        <div className="test-header-select-wrapper">
          <select
            value={caLevel}
            onChange={(e) => onChangeCaLevel(e.target.value)}
            className="test-header-level-select"
          >
            <option value="Foundation">CA Foundation</option>
            <option value="Intermediate">CA Intermediate</option>
            <option value="Final">CA Final</option>
          </select>
          <ChevronDown size={14} className="test-select-chevron" />
        </div>
      </div>

      {/* Title Header */}
      <div className="welcome-banner" style={{ marginTop: '16px', marginBottom: '16px' }}>
        <div>
          <span className="level-badge">Exam Preparedness</span>
          <h2 className="welcome-title">Practice Tests</h2>
          <p className="welcome-subtitle">Track mock scores, attempt papers and master confidence.</p>
        </div>
      </div>

      {/* Summary Stats Overview Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper blue">
            <ClipboardList size={20} />
          </div>
          <div>
            <div className="stat-num">{stats.count}</div>
            <div className="stat-lbl">Papers Logged</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper green">
            <Award size={20} />
          </div>
          <div>
            <div className="stat-num">{stats.count > 0 ? `${stats.averagePercentage}%` : 'N/A'}</div>
            <div className="stat-lbl">Average Score</div>
          </div>
        </div>

        <div className="stat-card full-width">
          <div className="stat-icon-wrapper gold">
            <BookOpen size={20} />
          </div>
          <div>
            <div className="stat-num" style={{ fontSize: '14px', lineHeight: '1.4' }}>
              {stats.count > 0 ? stats.highestTestName : 'No records yet'}
            </div>
            <div className="stat-lbl">Highest Performing Subject</div>
          </div>
        </div>
      </div>

      {/* Interactive Mock Tests List grouped by subject */}
      <div className="profile-section-card mt-2">
        <div className="profile-section-header cyan">
          <div className="section-icon-badge cyan">
            <BookOpen size={18} />
          </div>
          <h3 className="section-header-title">Prepopulated Mock Papers & MCQs</h3>
        </div>

        <div className="subject-collapsible-list mt-3">
          {activeSubjects.length === 0 ? (
            <p className="no-subjects-msg py-3">No subjects active for this level.</p>
          ) : (
            activeSubjects.map((sub) => {
              const staticPapers = MOCK_TESTS_DATA[caLevel]?.[sub] || [];
              const dynPapers = dynamicPapers.filter(
                (p) => (p as any).level === caLevel && (p as any).subject === sub
              );
              const papers = [...staticPapers, ...dynPapers];
              const isExpanded = !!expandedSubjects[sub];
              
              return (
                <div key={sub} className="subject-expand-card mt-2">
                  <div
                    className="subject-expand-header"
                    onClick={() => toggleSubjectExpand(sub)}
                  >
                    <div className="subject-header-left">
                      <div className="subject-header-details">
                        <span className="subject-name-txt">{sub}</span>
                        <span className="subject-chapters-count">{papers.length} Available Papers</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>

                  {isExpanded && (
                    <div className="subject-expand-body">
                      {papers.length === 0 ? (
                        <p className="no-papers-msg">No preloaded papers available for this subject.</p>
                      ) : (
                        papers.map((paper) => {
                          const logEntry = getTestLogStatus(sub, paper.title);
                          const isAttempted = !!logEntry;
                          const paperScore = logEntry ? Math.round((logEntry.marksObtained / logEntry.totalMarks) * 100) : null;
                          
                          return (
                            <div key={paper.id} className="paper-row-card">
                              <div className="paper-row-left">
                                <h4 className="paper-row-title">{paper.title}</h4>
                                <div className="paper-row-badge-row">
                                  <span className={`paper-type-badge ${paper.type === 'MCQ' ? 'mcq' : 'subjective'}`}>
                                    {paper.type}
                                  </span>
                                  <span className="paper-meta-text">
                                    {paper.questions.length} Questions • {paper.totalMarks} Marks
                                  </span>
                                </div>
                              </div>

                              <div className="paper-row-right">
                                {isAttempted && (
                                  <div className="paper-attempt-info">
                                    <span className="paper-attempt-lbl">Last Attempt:</span>
                                    <span className="paper-attempt-score">{paperScore}%</span>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleStartAttempt(paper, sub)}
                                  className="action-button-primary paper-attempt-btn"
                                >
                                  {isAttempted ? 'Re-attempt' : 'Attempt'}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Log Score Form Toggle button */}
      <div className="test-action-trigger-row mt-4">
        {!showLogForm ? (
          <button
            type="button"
            onClick={() => setShowLogForm(true)}
            className="action-button-secondary"
          >
            <Plus size={16} />
            <span>Manually Log Offline Test Score</span>
          </button>
        ) : (
          <div className="profile-section-card w-full slide-up">
            <div className="profile-section-header purple">
              <div className="section-icon-badge purple">
                <Award size={18} />
              </div>
              <h3 className="section-header-title">Manually Log Test</h3>
            </div>
            
            <form onSubmit={handleLogScoreSubmit} className="log-form mt-3">
              <div className="input-group">
                <label>Subject</label>
                <select
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="styled-select"
                  required
                >
                  {activeSubjects.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                  {activeSubjects.length === 0 && (
                    <option value="">No active subjects found</option>
                  )}
                </select>
              </div>

              <div className="input-group mt-3">
                <label>Test Title / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Offline Mock Test Paper 1"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="styled-task-input"
                  required
                />
              </div>

              <div className="form-row mt-3">
                <div className="input-group">
                  <label>Marks Obtained</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Marks"
                    value={marksObtained}
                    onChange={(e) => setMarksObtained(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="styled-num-input"
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Total Marks</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Out of"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="styled-num-input"
                    required
                  />
                </div>
              </div>

              <div className="input-group mt-3">
                <label>Date of Attempt</label>
                <div className="date-input-wrapper">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="styled-date-input-field"
                    required
                  />
                  <Calendar size={14} className="date-field-icon" />
                </div>
              </div>

              <div className="input-group mt-3">
                <label>Review Notes / Key Mistakes</label>
                <textarea
                  placeholder="Notes on chapters that require review, timing feedback, etc. (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="styled-task-input"
                  rows={2}
                  style={{ resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
                />
              </div>

              <div className="profile-action-buttons-row mt-4">
                <button type="submit" className="profile-save-btn">
                  Save Score
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogForm(false)}
                  className="profile-cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Attempt History Logs */}
      <div className="profile-section-card mt-4" style={{ paddingBottom: '10px' }}>
        <div className="profile-section-header purple">
          <div className="section-icon-badge purple">
            <ClipboardList size={18} />
          </div>
          <h3 className="section-header-title">Log History</h3>
        </div>

        <div className="test-logs-list mt-3">
          {tests.length === 0 ? (
            <div className="no-chapters-filter text-center py-6 text-slate-400">
              <Info size={28} className="mx-auto mb-2 opacity-50" />
              <p>No tests logged yet. Track your first score above!</p>
            </div>
          ) : (
            tests.map((t) => {
              const scorePct = (t.marksObtained / t.totalMarks) * 100;
              let badgeClass = 'fail'; // default
              if (scorePct >= 60) badgeClass = 'excellent';
              else if (scorePct >= 40) badgeClass = 'pass';
              
              return (
                <div key={t.id} className="test-attempt-log-card">
                  <div className="attempt-card-top">
                    <div className="attempt-card-info">
                      <span className="attempt-sub-title">{t.subjectName}</span>
                      <h4 className="attempt-test-desc">{t.testName}</h4>
                      <div className="attempt-date-row">
                        <Calendar size={12} />
                        <span>{t.date}</span>
                      </div>
                    </div>

                    <div className="attempt-score-container">
                      <div className="attempt-score-numerical">
                        <span className="obtained">{t.marksObtained}</span>
                        <span className="separator">/</span>
                        <span className="total">{t.totalMarks}</span>
                      </div>
                      <span className={`attempt-pct-badge ${badgeClass}`}>
                        {Math.round(scorePct)}%
                      </span>
                    </div>
                  </div>

                  {t.notes && (
                    <div className="attempt-card-notes mt-2">
                      <strong>Notes:</strong> {t.notes}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteRecord(t.id)}
                    className="attempt-delete-action-btn"
                    title="Delete log"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ChevronUp helper for collapsible list since it is used but not imported
const ChevronUp: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-up">
    <path d="m18 15-6-6-6 6" />
  </svg>
);
