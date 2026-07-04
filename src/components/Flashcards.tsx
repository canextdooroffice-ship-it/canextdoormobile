import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, Plus, Search, Edit2, Trash2, X, 
  Layers, RotateCcw, HelpCircle, Sparkles, BookOpen, 
  AlertTriangle, Eye, ArrowRight, CheckCircle2, BookmarkPlus, BarChart2
} from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import type { ProgressState } from './Subjects';
import type { Mistake } from './Analytics';

export interface Flashcard {
  id: string;
  front: string; // Question
  back: string;  // Answer
  hint?: string;
  tags?: string[];
  easeFactor: number;
  interval: number; // in days
  repetitions: number;
  nextReviewDate: string; // YYYY-MM-DD
  status: 'new' | 'learning' | 'review' | 'mastered';
  lastGraded?: 'Again' | 'Hard' | 'Good' | 'Easy';
  subjectName: string;
  chapterName?: string;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  subjectName: string;
  isCustom?: boolean;
}

interface FlashcardsProps {
  flashcards: Flashcard[];
  setFlashcards: (cards: Flashcard[]) => void;
  flashcardDecks: FlashcardDeck[];
  setFlashcardDecks: (decks: FlashcardDeck[]) => void;
  mistakes: Mistake[];
  setMistakes: React.Dispatch<React.SetStateAction<Mistake[]>>;
  progressState: ProgressState;
  caLevel: string;
  onBack: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

// Helpers
const getLocalDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};


export const Flashcards: React.FC<FlashcardsProps> = ({
  flashcards,
  setFlashcards,
  flashcardDecks,
  setFlashcardDecks,
  mistakes,
  setMistakes,
  progressState,
  caLevel,
  onBack,
  showToast
}) => {
  // Navigation inside Flashcards
  // 'decks' | 'deck-detail' | 'study-session'
  const [viewMode, setViewMode] = useState<'decks' | 'deck-detail' | 'study-session' | 'stats'>('decks');
  
  // Selected Deck
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // Study Session State
  const [studyQueue, setStudyQueue] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [gradedBreakdown, setGradedBreakdown] = useState<Record<string, number>>({
    Again: 0, Hard: 0, Good: 0, Easy: 0
  });
  const [showSummary, setShowSummary] = useState(false);

  // Modals state
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);
  const [deckName, setDeckName] = useState('');
  const [deckSubject, setDeckSubject] = useState('');

  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [cardHint, setCardHint] = useState('');
  const [cardTagsString, setCardTagsString] = useState('');
  const [cardChapter, setCardChapter] = useState('');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSelectedIds, setImportSelectedIds] = useState<string[]>([]);

  // Get active subjects based on caLevel and progressState
  const activeSubjects = useMemo(() => {
    return Object.keys(progressState).sort();
  }, [progressState]);

  // 0. One-time cleanup: remove any legacy mock 'sample-card-*' cards seeded by old code
  useEffect(() => {
    const hasMockCards = flashcards.some(c => c.id.startsWith('sample-card-'));
    if (!hasMockCards) return;
    const cleaned = flashcards.filter(c => !c.id.startsWith('sample-card-'));
    setFlashcards(cleaned);
    showToast('Removed old sample cards. Your decks are now clean!', 'info');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // 1. Auto-initialize empty decks for all active subjects
  useEffect(() => {
    if (activeSubjects.length === 0) return;

    // Only run if no decks exist for this level yet
    const hasDecksForLevel = flashcardDecks.some(d => activeSubjects.includes(d.subjectName));
    if (hasDecksForLevel) return;

    // Create one empty deck per subject — no sample cards
    const newDecks: FlashcardDeck[] = activeSubjects.map((sub, idx) => ({
      id: `default-deck-${caLevel}-${idx}-${Date.now()}`,
      name: sub,
      subjectName: sub,
      isCustom: false
    }));

    setFlashcardDecks([...flashcardDecks, ...newDecks]);
    showToast(`Flashcard decks ready for CA ${caLevel}. Start adding your own cards!`, 'info');
  }, [caLevel, activeSubjects, flashcardDecks, setFlashcardDecks, showToast]);

  // Derived deck statistics
  const deckStats = useMemo(() => {
    const today = getLocalDateString();
    const stats: Record<string, { total: number; mastered: number; due: number }> = {};
    
    flashcardDecks.forEach(deck => {
      const deckCards = flashcards.filter(c => c.subjectName === deck.subjectName);
      const total = deckCards.length;
      const mastered = deckCards.filter(c => c.status === 'mastered').length;
      const due = deckCards.filter(c => c.status === 'new' || c.nextReviewDate <= today).length;
      stats[deck.id] = { total, mastered, due };
    });

    return stats;
  }, [flashcardDecks, flashcards]);

  // Current deck cards
  const currentDeckCards = useMemo(() => {
    if (!selectedDeck) return [];
    return flashcards.filter(c => c.subjectName === selectedDeck.subjectName);
  }, [selectedDeck, flashcards]);

  // Unique tags for filter dropdown/list
  const deckTags = useMemo(() => {
    const tags = new Set<string>();
    currentDeckCards.forEach(c => {
      c.tags?.forEach(t => tags.add(t));
    });
    return ['All', ...Array.from(tags).sort()];
  }, [currentDeckCards]);

  // Filtered deck cards for display
  const filteredCards = useMemo(() => {
    let result = currentDeckCards;
    
    if (selectedTag !== 'All') {
      result = result.filter(c => c.tags?.includes(selectedTag));
    }
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        c => c.front.toLowerCase().includes(q) || 
             c.back.toLowerCase().includes(q) ||
             c.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    
    return result;
  }, [currentDeckCards, selectedTag, searchQuery]);

  // Subject chapters list for dropdowns
  const selectedDeckChapters = useMemo(() => {
    if (!selectedDeck || !progressState[selectedDeck.subjectName]) return [];
    return Object.keys(progressState[selectedDeck.subjectName]).sort();
  }, [selectedDeck, progressState]);

  // ----------------------------------------------------
  // DECK CRUD
  // ----------------------------------------------------
  const handleOpenDeckModal = (deck: FlashcardDeck | null = null) => {
    if (deck) {
      setEditingDeck(deck);
      setDeckName(deck.name);
      setDeckSubject(deck.subjectName);
    } else {
      setEditingDeck(null);
      setDeckName('');
      setDeckSubject(activeSubjects[0] || '');
    }
    setIsDeckModalOpen(true);
  };

  const handleSaveDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckName.trim() || !deckSubject) {
      showToast('Deck name and subject are required.', 'error');
      return;
    }

    if (editingDeck) {
      // Edit
      const updated = flashcardDecks.map(d => 
        d.id === editingDeck.id ? { ...d, name: deckName, subjectName: deckSubject } : d
      );
      // Update flashcards mapping
      const updatedCards = flashcards.map(c => 
        c.subjectName === editingDeck.subjectName ? { ...c, subjectName: deckSubject } : c
      );
      setFlashcardDecks(updated);
      setFlashcards(updatedCards);
      showToast('Deck updated successfully!', 'success');
    } else {
      // Create Custom
      const newDeck: FlashcardDeck = {
        id: `deck-${Date.now()}`,
        name: deckName,
        subjectName: deckSubject,
        isCustom: true
      };
      setFlashcardDecks([...flashcardDecks, newDeck]);
      showToast('Custom deck created!', 'success');
    }
    setIsDeckModalOpen(false);
  };

  const handleDeleteDeck = (deckId: string) => {
    const deckToDelete = flashcardDecks.find(d => d.id === deckId);
    if (!deckToDelete) return;

    if (window.confirm(`Are you sure you want to delete the deck "${deckToDelete.name}"? This will delete all cards inside it!`)) {
      setFlashcardDecks(flashcardDecks.filter(d => d.id !== deckId));
      setFlashcards(flashcards.filter(c => c.subjectName !== deckToDelete.subjectName));
      showToast('Deck deleted.', 'info');
      if (selectedDeck?.id === deckId) {
        setSelectedDeck(null);
        setViewMode('decks');
      }
    }
  };

  // ----------------------------------------------------
  // CARD CRUD
  // ----------------------------------------------------
  const handleOpenCardModal = (card: Flashcard | null = null) => {
    if (card) {
      setEditingCard(card);
      setCardFront(card.front);
      setCardBack(card.back);
      setCardHint(card.hint || '');
      setCardTagsString(card.tags?.join(', ') || '');
      setCardChapter(card.chapterName || '');
    } else {
      setEditingCard(null);
      setCardFront('');
      setCardBack('');
      setCardHint('');
      setCardTagsString('');
      setCardChapter(selectedDeckChapters[0] || '');
    }
    setIsCardModalOpen(true);
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardFront.trim() || !cardBack.trim()) {
      showToast('Question and Answer are required.', 'error');
      return;
    }

    const parsedTags = cardTagsString
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (editingCard) {
      const updated = flashcards.map(c => 
        c.id === editingCard.id 
          ? { 
              ...c, 
              front: cardFront, 
              back: cardBack, 
              hint: cardHint || undefined, 
              tags: parsedTags, 
              chapterName: cardChapter || undefined 
            } 
          : c
      );
      setFlashcards(updated);
      showToast('Flashcard updated!', 'success');
    } else {
      const newCard: Flashcard = {
        id: `card-${Date.now()}`,
        front: cardFront,
        back: cardBack,
        hint: cardHint || undefined,
        tags: parsedTags,
        chapterName: cardChapter || undefined,
        subjectName: selectedDeck!.subjectName,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: getLocalDateString(),
        status: 'new'
      };
      setFlashcards([...flashcards, newCard]);
      showToast('Flashcard added!', 'success');
    }
    setIsCardModalOpen(false);
  };

  const handleDeleteCard = (cardId: string) => {
    if (window.confirm('Delete this flashcard?')) {
      setFlashcards(flashcards.filter(c => c.id !== cardId));
      showToast('Card deleted.', 'info');
    }
  };

  // ----------------------------------------------------
  // STUDY SESSION LOGIC (Leitner System)
  // ----------------------------------------------------
  const startStudySession = (deck: FlashcardDeck) => {
    const today = getLocalDateString();
    // Filter due cards: status === 'new' OR nextReviewDate <= today
    const due = flashcards.filter(
      c => c.subjectName === deck.subjectName && (c.status === 'new' || c.nextReviewDate <= today)
    );

    if (due.length === 0) {
      showToast('No cards due for review in this deck today! Great job!', 'info');
      return;
    }

    // Shuffle due cards
    const shuffled = [...due].sort(() => Math.random() - 0.5);
    setStudyQueue(shuffled);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setSessionStartTime(Date.now());
    setGradedBreakdown({ Again: 0, Hard: 0, Good: 0, Easy: 0 });
    setShowSummary(false);
    setSelectedDeck(deck);
    setViewMode('study-session');
  };

  const handleGradeCard = (grade: 'Again' | 'Hard' | 'Good' | 'Easy') => {
    const today = getLocalDateString();
    const currentCard = studyQueue[currentCardIndex];
    let nextInterval = 0;
    let nextStatus: 'new' | 'learning' | 'review' | 'mastered' = 'learning';

    // Leitner / Spaced Repetition Scheduling
    switch (grade) {
      case 'Again':
        nextInterval = 0;
        nextStatus = 'learning';
        break;
      case 'Hard':
        nextInterval = 1;
        nextStatus = 'learning';
        break;
      case 'Good':
        nextInterval = 3;
        nextStatus = 'review';
        break;
      case 'Easy':
        nextInterval = 7;
        nextStatus = 'mastered';
        break;
    }

    const updatedNextReviewDate = addDays(today, nextInterval);

    // Update global flashcards array
    const updatedFlashcards = flashcards.map(c => 
      c.id === currentCard.id 
        ? {
            ...c,
            interval: nextInterval,
            nextReviewDate: updatedNextReviewDate,
            status: nextStatus,
            repetitions: c.repetitions + 1,
            lastGraded: grade
          }
        : c
    );
    setFlashcards(updatedFlashcards);

    // Record session breakdown
    setGradedBreakdown(prev => ({
      ...prev,
      [grade]: prev[grade] + 1
    }));

    // Proceed to next card or trigger session summary
    if (grade === 'Again') {
      // Re-add to queue at the end of current session
      const copyQueue = [...studyQueue];
      // Insert at the end or random place in remaining queue
      copyQueue.push({ ...currentCard, lastGraded: grade });
      setStudyQueue(copyQueue);
    }

    if (currentCardIndex + 1 < studyQueue.length) {
      // Move to next
      setIsFlipped(false);
      setShowHint(false);
      setCurrentCardIndex(prev => prev + 1);
    } else {
      // Finish
      setShowSummary(true);
    }
  };

  const handleLogCardToMistakeJournal = () => {
    const currentCard = studyQueue[currentCardIndex];
    const newMistake: Mistake = {
      id: `mistake-${Date.now()}`,
      subjectName: currentCard.subjectName,
      chapterName: currentCard.chapterName || 'General',
      category: 'Conceptual',
      mistakeType: 'Flashcard Recall Failure',
      severity: 'Medium',
      whatWrong: `Failed to recall card front: "${currentCard.front}"`,
      correctApproach: `Correct card back details: "${currentCard.back}"`,
      rootCause: 'Weak conceptual memorization / spaced repetition recall gap.',
      createdAt: new Date().toISOString()
    };
    setMistakes([...mistakes, newMistake]);
    showToast('Logged to Mistake Journal!', 'success');
  };

  // ----------------------------------------------------
  // MISTAKE JOURNAL IMPORT INTEGRATION
  // ----------------------------------------------------
  const availableMistakesForImport = useMemo(() => {
    if (!selectedDeck) return [];
    // Find mistakes belonging to this subject that aren't already imported as flashcards
    const existingFronts = new Set(currentDeckCards.map(c => c.front.toLowerCase()));
    
    return mistakes.filter(
      m => m.subjectName === selectedDeck.subjectName && 
           !existingFronts.has(`[Mistake: ${m.category}] ${m.mistakeType}\n\nQuestion/What Went Wrong:\n${m.whatWrong}`.toLowerCase())
    );
  }, [selectedDeck, mistakes, currentDeckCards]);

  const handleOpenImportModal = () => {
    if (availableMistakesForImport.length === 0) {
      showToast('No new mistakes found in the journal for this subject to import.', 'info');
      return;
    }
    setImportSelectedIds(availableMistakesForImport.map(m => m.id)); // Select all by default
    setIsImportModalOpen(true);
  };

  const handleImportMistakes = () => {
    if (importSelectedIds.length === 0) return;

    const selectedMistakes = availableMistakesForImport.filter(m => importSelectedIds.includes(m.id));
    const importedCards: Flashcard[] = selectedMistakes.map((m, idx) => ({
      id: `imported-card-${m.id}-${idx}-${Date.now()}`,
      front: `[Mistake: ${m.category}] ${m.mistakeType}\n\nQuestion/What Went Wrong:\n${m.whatWrong}`,
      back: `Correct Approach:\n${m.correctApproach}\n\nRoot Cause:\n${m.rootCause}${m.description ? `\n\nNotes:\n${m.description}` : ''}`,
      hint: `Mistake Category: ${m.category}`,
      tags: ['Imported', 'Mistake', m.category],
      chapterName: m.chapterName,
      subjectName: selectedDeck!.subjectName,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewDate: getLocalDateString(),
      status: 'new'
    }));

    setFlashcards([...flashcards, ...importedCards]);
    showToast(`Successfully imported ${importedCards.length} flashcards from Mistake Journal!`, 'success');
    setIsImportModalOpen(false);
  };

  // ----------------------------------------------------
  // GLOBAL STATISTICS COMPUTATIONS
  // ----------------------------------------------------
  const globalStats = useMemo(() => {
    const today = getLocalDateString();
    const total = flashcards.length;
    const statusNew = flashcards.filter(c => c.status === 'new').length;
    const statusLearning = flashcards.filter(c => c.status === 'learning').length;
    const statusReview = flashcards.filter(c => c.status === 'review').length;
    const statusMastered = flashcards.filter(c => c.status === 'mastered').length;
    const dueToday = flashcards.filter(c => c.status === 'new' || c.nextReviewDate <= today).length;
    const reviewed = flashcards.filter(c => c.repetitions > 0);
    const totalReviewed = reviewed.length;
    const retainedCount = reviewed.filter(c => c.lastGraded === 'Good' || c.lastGraded === 'Easy').length;
    const retentionRate = totalReviewed > 0 ? Math.round((retainedCount / totalReviewed) * 100) : 0;
    
    // Grade distribution across all cards
    const gradeAgain = flashcards.filter(c => c.lastGraded === 'Again').length;
    const gradeHard = flashcards.filter(c => c.lastGraded === 'Hard').length;
    const gradeGood = flashcards.filter(c => c.lastGraded === 'Good').length;
    const gradeEasy = flashcards.filter(c => c.lastGraded === 'Easy').length;
    const totalGraded = gradeAgain + gradeHard + gradeGood + gradeEasy;

    // 7-day forecast
    const forecast: { date: string; label: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const label = i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' });
      const count = i === 0
        ? dueToday
        : flashcards.filter(c => c.nextReviewDate === dateStr).length;
      forecast.push({ date: dateStr, label, count });
    }
    const forecastMax = Math.max(...forecast.map(f => f.count), 1);

    // Per-deck breakdown
    const deckBreakdown = flashcardDecks.map(deck => {
      const cards = flashcards.filter(c => c.subjectName === deck.subjectName);
      const deckTotal = cards.length;
      const deckMastered = cards.filter(c => c.status === 'mastered').length;
      const deckDue = cards.filter(c => c.status === 'new' || c.nextReviewDate <= today).length;
      const masteryPct = deckTotal > 0 ? Math.round((deckMastered / deckTotal) * 100) : 0;
      return { name: deck.name, total: deckTotal, mastered: deckMastered, due: deckDue, masteryPct };
    });

    return {
      total, statusNew, statusLearning, statusReview, statusMastered,
      dueToday, retentionRate, totalReviewed,
      gradeAgain, gradeHard, gradeGood, gradeEasy, totalGraded,
      forecast, forecastMax, deckBreakdown
    };
  }, [flashcards, flashcardDecks]);

  // UI calculations for session summary
  const sessionDurationMinutes = useMemo(() => {
    if (!sessionStartTime) return 0;
    const diff = Date.now() - sessionStartTime;
    return Math.max(1, Math.round(diff / 60000));
  }, [showSummary, sessionStartTime]);

  const sessionAccuracy = useMemo(() => {
    const totalGrades = gradedBreakdown.Again + gradedBreakdown.Hard + gradedBreakdown.Good + gradedBreakdown.Easy;
    if (totalGrades === 0) return 0;
    return Math.round(((gradedBreakdown.Good + gradedBreakdown.Easy) / totalGrades) * 100);
  }, [gradedBreakdown]);

  return (
    <div className="links-manager-container fade-in">
      {/* Header */}
      <div className="links-header-bar">
        <button 
          type="button" 
          className="links-back-btn" 
          onClick={() => {
            if (viewMode === 'decks' || viewMode === 'stats') {
              if (viewMode === 'stats') { setViewMode('decks'); return; }
              onBack();
            } else if (viewMode === 'deck-detail') {
              setSelectedDeck(null);
              setViewMode('decks');
            } else if (viewMode === 'study-session') {
              if (window.confirm('Quit current study session? Progress on completed cards will be saved.')) {
                setViewMode('deck-detail');
              }
            }
          }}
          aria-label="Back"
        >
          <ArrowLeft size={16} />
          <span>
            {viewMode === 'decks' ? 'Tools' : 'Back'}
          </span>
        </button>
        <h2 className="links-header-title">
          {viewMode === 'decks' && 'Flashcards'}
          {viewMode === 'stats' && 'Statistics'}
          {viewMode === 'deck-detail' && (selectedDeck?.name ?? 'Deck')}
          {viewMode === 'study-session' && 'Study Mode'}
        </h2>
        {viewMode === 'decks' && (
        <div className="fc-header-actions">
            <button
              type="button"
              className="fc-stats-toggle-btn"
              onClick={() => setViewMode('stats')}
              title="View Statistics"
            >
              <BarChart2 size={16} />
            </button>
            <button 
              type="button"
              className="fc-add-deck-btn"
              onClick={() => handleOpenDeckModal()}
              title="New Deck"
            >
              <Plus size={18} />
            </button>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------
          1. DECKS GRID VIEW
          ---------------------------------------------------- */}
      {viewMode === 'decks' && (
        <div className="links-main-panel">
          <div className="links-intro-card">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <Sparkles size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
              <p className="links-intro-text">
                <strong>Spaced Repetition</strong> — Reinforce your memory on key sections, standards, and formulas. Cards reappear based on how well you know them.
              </p>
            </div>
          </div>

          <div className="decks-section-header">
            <h3>Your Subject Decks</h3>
          </div>

          {flashcardDecks.length === 0 ? (
            <div className="empty-decks-state">
              <BookOpen size={40} className="empty-icon" />
              <p>No active decks. Create one above or switch your CA level in settings to load standard decks.</p>
            </div>
          ) : (
            <div className="decks-grid">
              {flashcardDecks.map(deck => {
                const stats = deckStats[deck.id] || { total: 0, mastered: 0, due: 0 };
                const masteredPercent = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
                
                return (
                  <div key={deck.id} className="deck-card">
                    <div className="deck-card-main">
                      <div className="deck-icon-badge">
                        <Layers size={18} />
                      </div>
                      <div className="deck-info">
                        <h4 className="deck-title" title={deck.name}>{deck.name}</h4>
                        {deck.name.toLowerCase() !== deck.subjectName.toLowerCase() && (
                          <span className="deck-subject-badge">{deck.subjectName}</span>
                        )}
                      </div>
                    </div>

                    <div className="deck-stats-wrapper">
                      <div className="deck-stat-line">
                        <span className="stat-label">Mastered</span>
                        <span className="stat-val">{stats.mastered} / {stats.total} cards</span>
                      </div>
                      <div className="deck-progress-bar-container">
                        <div 
                          className="deck-progress-bar-fill" 
                          style={{ width: `${masteredPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="deck-card-actions">
                      <button 
                        className={`deck-action-study ${stats.due > 0 ? 'due' : ''}`}
                        onClick={() => startStudySession(deck)}
                        disabled={stats.total === 0}
                      >
                        {stats.due > 0 ? (
                          <>
                            <span>Study ({stats.due} due)</span>
                            <ArrowRight size={14} />
                          </>
                        ) : (
                          <span>All Caught Up!</span>
                        )}
                      </button>
                      <button 
                        className="deck-action-manage"
                        onClick={() => {
                          setSelectedDeck(deck);
                          setViewMode('deck-detail');
                          setSelectedTag('All');
                          setSearchQuery('');
                        }}
                      >
                        <span>Manage</span>
                      </button>
                      {deck.isCustom && (
                        <div className="deck-custom-crud-btns">
                          <button 
                            className="deck-small-btn edit"
                            onClick={() => handleOpenDeckModal(deck)}
                            title="Edit Deck"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            className="deck-small-btn delete"
                            onClick={() => handleDeleteDeck(deck.id)}
                            title="Delete Deck"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          STATS VIEW
          ---------------------------------------------------- */}
      {viewMode === 'stats' && (
        <div className="links-main-panel fc-stats-panel">

          {/* ── Overview Tiles ── */}
          <div className="decks-section-header"><h3>Overview</h3></div>
          <div className="fc-stats-tiles">
            <div className="fc-stat-tile">
              <span className="fc-tile-num">{globalStats.total}</span>
              <span className="fc-tile-lbl">Total Cards</span>
            </div>
            <div className="fc-stat-tile due">
              <span className="fc-tile-num">{globalStats.dueToday}</span>
              <span className="fc-tile-lbl">Due Today</span>
            </div>
            <div className="fc-stat-tile mastered">
              <span className="fc-tile-num">{globalStats.statusMastered}</span>
              <span className="fc-tile-lbl">Mastered</span>
            </div>
            <div className="fc-stat-tile retention">
              <span className="fc-tile-num">{globalStats.retentionRate}%</span>
              <span className="fc-tile-lbl">Retention</span>
            </div>
          </div>

          {/* ── Status Breakdown ── */}
          <div className="decks-section-header" style={{ marginTop: '8px' }}><h3>Card Status</h3></div>
          <div className="fc-stats-card">
            {globalStats.total === 0 ? (
              <p className="fc-empty-note">No cards yet. Add cards to see status breakdown.</p>
            ) : (
              <>
                <div className="fc-status-bar">
                  {globalStats.statusNew > 0 && (
                    <div
                      className="fc-status-seg new"
                      style={{ flex: globalStats.statusNew }}
                      title={`New: ${globalStats.statusNew}`}
                    />
                  )}
                  {globalStats.statusLearning > 0 && (
                    <div
                      className="fc-status-seg learning"
                      style={{ flex: globalStats.statusLearning }}
                      title={`Learning: ${globalStats.statusLearning}`}
                    />
                  )}
                  {globalStats.statusReview > 0 && (
                    <div
                      className="fc-status-seg review"
                      style={{ flex: globalStats.statusReview }}
                      title={`Review: ${globalStats.statusReview}`}
                    />
                  )}
                  {globalStats.statusMastered > 0 && (
                    <div
                      className="fc-status-seg mastered"
                      style={{ flex: globalStats.statusMastered }}
                      title={`Mastered: ${globalStats.statusMastered}`}
                    />
                  )}
                </div>
                <div className="fc-status-legend">
                  <span className="fc-legend-item new"><span className="fc-legend-dot" />New ({globalStats.statusNew})</span>
                  <span className="fc-legend-item learning"><span className="fc-legend-dot" />Learning ({globalStats.statusLearning})</span>
                  <span className="fc-legend-item review"><span className="fc-legend-dot" />Review ({globalStats.statusReview})</span>
                  <span className="fc-legend-item mastered"><span className="fc-legend-dot" />Mastered ({globalStats.statusMastered})</span>
                </div>
              </>
            )}
          </div>

          {/* ── 7-Day Forecast ── */}
          <div className="decks-section-header" style={{ marginTop: '8px' }}><h3>7-Day Forecast</h3></div>
          <div className="fc-stats-card">
            <div className="fc-forecast-chart">
              {globalStats.forecast.map((day, i) => (
                <div key={i} className={`fc-forecast-col ${i === 0 ? 'today' : ''}`}>
                  <span className="fc-forecast-count">{day.count > 0 ? day.count : ''}</span>
                  <div className="fc-forecast-bar-wrap">
                    <div
                      className="fc-forecast-bar"
                      style={{ height: `${Math.round((day.count / globalStats.forecastMax) * 100)}%` }}
                    />
                  </div>
                  <span className="fc-forecast-day">{day.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Grade Distribution ── */}
          <div className="decks-section-header" style={{ marginTop: '8px' }}><h3>Last Grade Distribution</h3></div>
          <div className="fc-stats-card">
            {globalStats.totalGraded === 0 ? (
              <p className="fc-empty-note">Study some cards to see grade distribution.</p>
            ) : (
              <div className="fc-grade-dist">
                {(['Again', 'Hard', 'Good', 'Easy'] as const).map(grade => {
                  const count = {
                    Again: globalStats.gradeAgain,
                    Hard: globalStats.gradeHard,
                    Good: globalStats.gradeGood,
                    Easy: globalStats.gradeEasy,
                  }[grade];
                  const pct = globalStats.totalGraded > 0 ? Math.round((count / globalStats.totalGraded) * 100) : 0;
                  return (
                    <div key={grade} className="fc-grade-row">
                      <span className={`fc-grade-label ${grade.toLowerCase()}`}>{grade}</span>
                      <div className="fc-grade-bar-track">
                        <div
                          className={`fc-grade-bar-fill ${grade.toLowerCase()}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="fc-grade-pct">{count} <span className="fc-grade-pct-dim">({pct}%)</span></span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Per-Deck Breakdown ── */}
          <div className="decks-section-header" style={{ marginTop: '8px' }}><h3>Per-Deck Breakdown</h3></div>
          <div className="fc-stats-card fc-deck-table">
            {globalStats.deckBreakdown.length === 0 ? (
              <p className="fc-empty-note">No decks yet.</p>
            ) : (
              globalStats.deckBreakdown.map((row, i) => (
                <div key={i} className="fc-deck-row">
                  <div className="fc-deck-row-info">
                    <span className="fc-deck-row-name">{row.name}</span>
                    <div className="fc-deck-row-meta">
                      <span className="fc-deck-row-chip total">{row.total} cards</span>
                      {row.due > 0 && <span className="fc-deck-row-chip due">{row.due} due</span>}
                      <span className="fc-deck-row-chip mastered">{row.masteryPct}% mastered</span>
                    </div>
                  </div>
                  <div className="fc-deck-mini-bar">
                    <div className="fc-deck-mini-fill" style={{ width: `${row.masteryPct}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* ----------------------------------------------------
          2. DECK DETAILS / CARDS MANAGEMENT VIEW
          ---------------------------------------------------- */}
      {viewMode === 'deck-detail' && selectedDeck && (
        <div className="links-main-panel">
          <div className="deck-detail-summary-card">
            <div className="deck-detail-title-line">
              <span className="deck-detail-lbl">Subject Deck</span>
              <h3>{selectedDeck.name}</h3>
            </div>
            <div className="deck-detail-quick-stats">
              <div className="stat-box">
                <span className="num">{currentDeckCards.length}</span>
                <span className="lbl">Total Cards</span>
              </div>
              <div className="stat-box">
                <span className="num">{deckStats[selectedDeck.id]?.due || 0}</span>
                <span className="lbl">Due Reviews</span>
              </div>
              <div className="stat-box">
                <span className="num">{deckStats[selectedDeck.id]?.mastered || 0}</span>
                <span className="lbl">Mastered</span>
              </div>
            </div>

            <div className="deck-detail-actions">
              <button 
                className="deck-detail-btn study primary"
                onClick={() => startStudySession(selectedDeck)}
                disabled={currentDeckCards.length === 0}
              >
                <Sparkles size={16} />
                <span>Start Review Session</span>
              </button>
              
              <button 
                className="deck-detail-btn secondary"
                onClick={() => handleOpenCardModal()}
              >
                <Plus size={16} />
                <span>Add Flashcard</span>
              </button>

              {mistakes.some(m => m.subjectName === selectedDeck.subjectName) && (
                <button 
                  className="deck-detail-btn info-accent"
                  onClick={handleOpenImportModal}
                  title="Import from Mistake Journal"
                >
                  <BookmarkPlus size={16} />
                  <span>Import Mistakes ({availableMistakesForImport.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="cards-filter-toolbar">
            <div className="search-bar-wrapper">
              <Search className="search-icon" size={16} />
              <input 
                type="text"
                placeholder="Search cards, concepts, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            {deckTags.length > 1 && (
              <div className="tags-scroll-container">
                {deckTags.map(tag => (
                  <button
                    key={tag}
                    className={`tag-chip ${selectedTag === tag ? 'active' : ''}`}
                    onClick={() => setSelectedTag(tag)}
                  >
                    {tag === 'All' ? 'All Tags' : `#${tag}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="cards-section-header">
            <h3>Flashcards ({filteredCards.length})</h3>
          </div>

          {filteredCards.length === 0 ? (
            <div className="empty-cards-state">
              <HelpCircle size={40} className="empty-icon" />
              <p>No cards match the active filters. Go ahead and add some!</p>
            </div>
          ) : (
            <div className="cards-list">
              {filteredCards.map(card => (
                <div key={card.id} className="card-item-row">
                  <div className="card-item-content">
                    <div className="card-item-face front">
                      <span className="face-lbl">FRONT (QUESTION)</span>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{card.front}</p>
                    </div>
                    <div className="card-item-face back">
                      <span className="face-lbl">BACK (ANSWER)</span>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{card.back}</p>
                    </div>
                    {card.hint && (
                      <div className="card-item-hint">
                        <span className="hint-tag">Hint:</span> {card.hint}
                      </div>
                    )}
                    {card.tags && card.tags.length > 0 && (
                      <div className="card-item-tags">
                        {card.tags.map(t => (
                          <span key={t} className="tag-pill">#{t}</span>
                        ))}
                        {card.chapterName && (
                          <span className="chapter-pill">📍 {card.chapterName}</span>
                        )}
                      </div>
                    )}
                    <div className="card-review-metadata">
                      <span className={`status-badge ${card.status}`}>
                        {card.status.toUpperCase()}
                      </span>
                      <span className="next-review-lbl">
                        Next: {card.nextReviewDate} (Interval: {card.interval}d)
                      </span>
                    </div>
                  </div>
                  <div className="card-item-actions">
                    <button 
                      className="card-small-btn edit"
                      onClick={() => handleOpenCardModal(card)}
                      title="Edit Card"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      className="card-small-btn delete"
                      onClick={() => handleDeleteCard(card.id)}
                      title="Delete Card"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          3. INTERACTIVE STUDY SESSION
          ---------------------------------------------------- */}
      {viewMode === 'study-session' && selectedDeck && (
        <div className="links-main-panel study-session-screen">
          {!showSummary ? (
            <>
              {/* Header metrics */}
              <div className="study-session-stats">
                <span className="progress-text">
                  Card {currentCardIndex + 1} of {studyQueue.length}
                </span>
                <div className="study-progress-bar-container">
                  <div 
                    className="study-progress-bar-fill"
                    style={{ width: `${((currentCardIndex) / studyQueue.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* 3D Flashcard Wrapper */}
              <div className="flashcard-3d-wrapper">
                <div 
                  className={`flashcard-3d-container ${isFlipped ? 'flipped' : ''}`}
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  {/* Front Side */}
                  <div className="flashcard-face front-face">
                    <div className="face-header">
                      <span className="subject-name">{selectedDeck.subjectName}</span>
                      {studyQueue[currentCardIndex]?.chapterName && (
                        <span className="chapter-name">📍 {studyQueue[currentCardIndex]?.chapterName}</span>
                      )}
                    </div>
                    <div className="face-body">
                      <p className="card-text" style={{ whiteSpace: 'pre-wrap' }}>{studyQueue[currentCardIndex]?.front}</p>
                    </div>
                    <div className="face-footer">
                      <Eye size={16} />
                      <span>Tap card to reveal answer</span>
                    </div>
                  </div>

                  {/* Back Side */}
                  <div className="flashcard-face back-face" onClick={(e) => e.stopPropagation()}>
                    <div className="face-header">
                      <span className="subject-name">{selectedDeck.subjectName}</span>
                      <span className="revealed-badge">REVEALED</span>
                    </div>
                    <div className="face-body">
                      <p className="card-text" style={{ whiteSpace: 'pre-wrap' }}>{studyQueue[currentCardIndex]?.back}</p>
                    </div>
                    <div className="face-footer" onClick={() => setIsFlipped(false)}>
                      <RotateCcw size={14} />
                      <span>Tap to flip back</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hint section */}
              {studyQueue[currentCardIndex]?.hint && (
                <div className="study-hint-section">
                  {showHint ? (
                    <div className="hint-bubble fade-in">
                      <strong>Hint:</strong> {studyQueue[currentCardIndex].hint}
                      <button className="hide-hint-btn" onClick={() => setShowHint(false)}>Hide</button>
                    </div>
                  ) : (
                    <button 
                      className="show-hint-btn" 
                      onClick={() => setShowHint(true)}
                    >
                      <HelpCircle size={14} />
                      <span>Need a hint?</span>
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="study-controls-wrapper">
                {!isFlipped ? (
                  <button 
                    className="study-reveal-large-btn"
                    onClick={() => setIsFlipped(true)}
                  >
                    Reveal Answer
                  </button>
                ) : (
                  <div className="leitner-grading-bar">
                    <button 
                      className="grade-btn again"
                      onClick={() => handleGradeCard('Again')}
                    >
                      <span className="key">AGAIN</span>
                      <span className="desc">Forgotten</span>
                    </button>
                    <button 
                      className="grade-btn hard"
                      onClick={() => handleGradeCard('Hard')}
                    >
                      <span className="key">HARD</span>
                      <span className="desc">1 day</span>
                    </button>
                    <button 
                      className="grade-btn good"
                      onClick={() => handleGradeCard('Good')}
                    >
                      <span className="key">GOOD</span>
                      <span className="desc">3 days</span>
                    </button>
                    <button 
                      className="grade-btn easy"
                      onClick={() => handleGradeCard('Easy')}
                    >
                      <span className="key">EASY</span>
                      <span className="desc">7 days</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mistake journal logger button */}
              {isFlipped && (
                <div className="study-mistake-logger-action">
                  <button 
                    className="journal-log-btn"
                    onClick={handleLogCardToMistakeJournal}
                  >
                    <AlertTriangle size={14} />
                    <span>Log to Mistake Journal</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            // Session Summary Screen
            <div className="study-summary-card fade-in">
              <div className="summary-success-check">
                <CheckCircle2 size={64} className="success-icon" />
              </div>
              <h3>Session Completed!</h3>
              <p className="subtitle">Outstanding effort! You reviewed {studyQueue.length} cards in this session.</p>

              <div className="summary-metrics-grid">
                <div className="metric-box">
                  <span className="title">Duration</span>
                  <span className="val">{sessionDurationMinutes}m</span>
                </div>
                <div className="metric-box">
                  <span className="title">Accuracy</span>
                  <span className="val">{sessionAccuracy}%</span>
                </div>
              </div>

              <div className="breakdown-chart-wrapper">
                <h4>Response Breakdown</h4>
                <div className="chart-bars-list">
                  <div className="bar-row">
                    <span className="lbl">Easy</span>
                    <div className="bar-outer">
                      <div className="bar-inner easy" style={{ width: `${(gradedBreakdown.Easy / studyQueue.length) * 100}%` }} />
                    </div>
                    <span className="cnt">{gradedBreakdown.Easy}</span>
                  </div>
                  <div className="bar-row">
                    <span className="lbl">Good</span>
                    <div className="bar-outer">
                      <div className="bar-inner good" style={{ width: `${(gradedBreakdown.Good / studyQueue.length) * 100}%` }} />
                    </div>
                    <span className="cnt">{gradedBreakdown.Good}</span>
                  </div>
                  <div className="bar-row">
                    <span className="lbl">Hard</span>
                    <div className="bar-outer">
                      <div className="bar-inner hard" style={{ width: `${(gradedBreakdown.Hard / studyQueue.length) * 100}%` }} />
                    </div>
                    <span className="cnt">{gradedBreakdown.Hard}</span>
                  </div>
                  <div className="bar-row">
                    <span className="lbl">Again</span>
                    <div className="bar-outer">
                      <div className="bar-inner again" style={{ width: `${(gradedBreakdown.Again / studyQueue.length) * 100}%` }} />
                    </div>
                    <span className="cnt">{gradedBreakdown.Again}</span>
                  </div>
                </div>
              </div>

              <button 
                className="summary-finish-btn"
                onClick={() => {
                  setViewMode('deck-detail');
                  setShowSummary(false);
                }}
              >
                Back to Deck
              </button>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          PORTAL: DECK EDIT / ADD MODAL
          ---------------------------------------------------- */}
      {isDeckModalOpen && createPortal(
        <div className="links-modal-overlay" onClick={() => setIsDeckModalOpen(false)}>
          <div className="links-modal-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="links-modal-header">
              <h3>{editingDeck ? 'Edit Deck' : 'Create Custom Deck'}</h3>
              <button type="button" className="links-modal-close-btn" onClick={() => setIsDeckModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveDeck}>
              <div className="modal-body scrollable-y">
                <div className="form-group">
                  <label htmlFor="deckNameInput" className="styled-form-label">Deck Name</label>
                  <input
                    id="deckNameInput"
                    type="text"
                    className="styled-form-input"
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    placeholder="e.g., Company Audit & Audit Report"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="styled-form-label">Assign to Subject</label>
                  <CustomSelect
                    value={deckSubject}
                    onChange={setDeckSubject}
                    options={activeSubjects}
                  />
                </div>
              </div>
              <div className="form-actions-row">
                <button type="submit" className="form-submit-btn">
                  {editingDeck ? 'Save Changes' : 'Create Deck'}
                </button>
                <button 
                  type="button" 
                  className="form-cancel-btn" 
                  onClick={() => setIsDeckModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ----------------------------------------------------
          PORTAL: FLASHCARD EDIT / ADD MODAL
          ---------------------------------------------------- */}
      {isCardModalOpen && createPortal(
        <div className="links-modal-overlay" onClick={() => setIsCardModalOpen(false)}>
          <div className="links-modal-sheet card-modal-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="links-modal-header">
              <h3>{editingCard ? 'Edit Flashcard' : 'Add Flashcard'}</h3>
              <button type="button" className="links-modal-close-btn" onClick={() => setIsCardModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveCard}>
              <div className="modal-body scrollable-y">
                <div className="form-group">
                  <label htmlFor="cardFrontInput" className="styled-form-label">Question (Front Face)</label>
                  <textarea
                    id="cardFrontInput"
                    className="styled-form-textarea"
                    value={cardFront}
                    onChange={(e) => setCardFront(e.target.value)}
                    placeholder="Write the concept question, section code query, or formula prompt..."
                    rows={4}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cardBackInput" className="styled-form-label">Answer (Back Face)</label>
                  <textarea
                    id="cardBackInput"
                    className="styled-form-textarea"
                    value={cardBack}
                    onChange={(e) => setCardBack(e.target.value)}
                    placeholder="Write the detailed correct answer, explanation, or key details..."
                    rows={5}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cardHintInput" className="styled-form-label">Hint / Mnemonic (Optional)</label>
                  <input
                    id="cardHintInput"
                    type="text"
                    className="styled-form-input"
                    value={cardHint}
                    onChange={(e) => setCardHint(e.target.value)}
                    placeholder="Provide a subtle prompt or memory trigger..."
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cardTagsInput" className="styled-form-label">Tags (Comma-separated)</label>
                  <input
                    id="cardTagsInput"
                    type="text"
                    className="styled-form-input"
                    value={cardTagsString}
                    onChange={(e) => setCardTagsString(e.target.value)}
                    placeholder="e.g., AS10, Capitalization, Important"
                  />
                </div>

                <div className="form-group">
                  <label className="styled-form-label">Assign to Chapter (Optional)</label>
                  <CustomSelect
                    value={cardChapter}
                    onChange={setCardChapter}
                    options={['General', ...selectedDeckChapters]}
                  />
                </div>
              </div>
              <div className="form-actions-row">
                <button type="submit" className="form-submit-btn">
                  {editingCard ? 'Save Card' : 'Add Card'}
                </button>
                <button 
                  type="button" 
                  className="form-cancel-btn" 
                  onClick={() => setIsCardModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ----------------------------------------------------
          PORTAL: MISTAKE JOURNAL IMPORT MODAL
          ---------------------------------------------------- */}
      {isImportModalOpen && selectedDeck && createPortal(
        <div className="links-modal-overlay" onClick={() => setIsImportModalOpen(false)}>
          <div className="links-modal-sheet import-modal-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="links-modal-header">
              <h3>Import from Mistake Journal</h3>
              <button type="button" className="links-modal-close-btn" onClick={() => setIsImportModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body scrollable-y">
              <p className="import-desc">
                Select logged mistakes from your journal to convert them into Spaced Repetition flashcards.
              </p>

              <div className="import-list-box">
                {availableMistakesForImport.map(m => {
                  const isChecked = importSelectedIds.includes(m.id);
                  return (
                    <div 
                      key={m.id} 
                      className={`import-item-row-check ${isChecked ? 'selected' : ''}`}
                      onClick={() => {
                        if (isChecked) {
                          setImportSelectedIds(importSelectedIds.filter(id => id !== m.id));
                        } else {
                          setImportSelectedIds([...importSelectedIds, m.id]);
                        }
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="import-checkbox"
                      />
                      <div className="import-item-info">
                        <div className="import-badge-line">
                          <span className={`cat-badge ${m.category.toLowerCase()}`}>{m.category}</span>
                          <span className="chap">{m.chapterName}</span>
                        </div>
                        <h4 className="type">{m.mistakeType}</h4>
                        <p className="wrong"><strong>Wrong:</strong> {m.whatWrong}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="form-actions-row">
              <button 
                type="button" 
                className="form-submit-btn"
                onClick={handleImportMistakes}
                disabled={importSelectedIds.length === 0}
              >
                Import Selected ({importSelectedIds.length})
              </button>
              <button 
                type="button" 
                className="form-cancel-btn" 
                onClick={() => setIsImportModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
