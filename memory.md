# CA Next Door PWA Mobile — Codebase Memory

> **Last Updated:** 2026-06-22  
> **Purpose:** Quick-reference document for AI agents to understand the entire codebase before making changes.

---

## 1. Project Overview

**CA Next Door** is a **Progressive Web App (PWA)** for **Chartered Accountancy (CA) students** in India. It's a comprehensive study tracking, planning, and mock-test platform supporting three CA levels: **Foundation**, **Intermediate**, and **Final**.

**Live Deployment:** Vercel. Backend: Supabase (PostgreSQL + Auth + Realtime).

### Key Features
- 📚 Subject & chapter tracking with class-done, priorities (A/B/C), LDRS, revision cycles
- ⏱️ Pomodoro timer (25/50/5 min) with auto-logging of study hours
- 📊 Dashboard with streaks, daily check-in, study hours, schedule notifications
- 📝 Mock Tests (MCQ + Subjective) with timed attempts, anti-cheat, and leaderboard
- 📅 Study Planner with timetable slots, tasks, revision tracking, mistake journal
- 📈 Analytics: time allocation per chapter/phase, revision tracker
- 🤝 Study Buddy: social feature with buddy codes, groups, realtime leaderboards
- 👤 Profile: CA level, exam date, articleship tracking, password change, notifications
- 🔗 Links Manager: bookmarking study resources by category
- 🛠️ Admin Panel: manage global subjects, mock papers, user accounts
- 🔄 PWA with offline support, service worker auto-update, push notifications

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 8 |
| **Styling** | Vanilla CSS (single `index.css` ~11,700 lines) |
| **Backend / DB** | Supabase (PostgreSQL, Auth, Realtime) |
| **Icons** | Lucide React |
| **Fonts** | Outfit (display), Plus Jakarta Sans (body), Caveat (handwriting) |
| **Export** | xlsx (Excel export for admin) |
| **PWA** | Custom Service Worker (`public/sw.js`) |
| **Hosting** | Vercel |

### Dependencies (`package.json`)
```
@supabase/supabase-js ^2.106.2
lucide-react ^1.17.0
react ^19.2.6 / react-dom ^19.2.6
xlsx ^0.18.5
```

---

## 3. Project Structure

```
CA Next Door PWA Mobile/
├── .env                          # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
├── index.html                    # PWA entry (manifest, viewport, theme-color)
├── vite.config.ts                # Minimal Vite + React plugin
├── update-sw-version.js          # Build script: stamps sw.js with ISO timestamp
├── supabase_setup.sql            # Full DB schema (tables, RLS policies, functions)
├── public/
│   ├── manifest.json             # PWA manifest (standalone, portrait, indigo theme)
│   ├── sw.js                     # Service Worker (stale-while-revalidate caching)
│   ├── logo.png                  # App icon (512x512)
│   └── icons.svg                 # SVG icon set
├── src/
│   ├── main.tsx                  # Entry: renders <App/>, registers SW, handles updates
│   ├── App.tsx                   # ⭐ MONOLITHIC MAIN FILE (~2100 lines, ~80KB)
│   ├── supabaseClient.ts         # Supabase client initialization with fallback
│   ├── index.css                 # ⭐ ALL STYLES (~11,700 lines, ~235KB)
│   ├── components/
│   │   ├── AdminPanel.tsx        # Admin: manage subjects, mock papers, users (~67KB)
│   │   ├── Analytics.tsx         # Revision tracker & mistake journal (~42KB)
│   │   ├── Auth.tsx              # Login/Signup with email+password (~10KB)
│   │   ├── BottomNav.tsx         # Bottom tab navigation bar (~1.4KB)
│   │   ├── CustomSelect.tsx      # Reusable dropdown select component (~2KB)
│   │   ├── Dashboard.tsx         # Main dashboard: stats, schedule, check-in (~39KB)
│   │   ├── LinksManager.tsx      # Save/manage study resource links by category (~16KB)
│   │   ├── Planner.tsx           # Study planner: calendar, logs, timer UI (~67KB)
│   │   ├── Profile.tsx           # User profile, settings, articleship, password (~23KB)
│   │   ├── StudyBuddy.tsx        # Social: buddy codes, groups, leaderboard (~44KB)
│   │   ├── Subjects.tsx          # Subject/chapter checklist with progress (~40KB)
│   │   ├── Test.tsx              # Mock test system: MCQ + Subjective (~72KB)
│   │   ├── TimeManager.tsx       # Study time allocation analysis (~12KB)
│   │   └── Tools.tsx             # Tools hub page (links to sub-features) (~2.6KB)
│   ├── constants/
│   │   ├── syllabus.ts           # Default CA syllabus data (subjects & chapters)
│   │   └── mockTests.ts          # Mock test type definitions
│   ├── lib/
│   │   └── syncProgress.ts       # Supabase sync helper (load/save progress)
│   └── assets/
│       ├── hero.png              # Landing/auth hero image
│       ├── react.svg
│       └── vite.svg
```

---

## 4. Architecture & Data Flow

### 4.1 Navigation (Hash-based, No Router Library)

`App.tsx` maintains `activeTab` state. `BottomNav.tsx` renders the tab bar.

**Bottom Navigation Tabs:**
| Tab ID | Component | Icon |
|--------|-----------|------|
| `home` | `<Dashboard>` | Home |
| `subjects` | `<Subjects>` | BookOpen |
| `planner` | `<Planner>` | Calendar |
| `analytics` | `<Analytics>` | BarChart2 |
| `profile` | `<Profile>` | User |
| `admin` | `<AdminPanel>` | Shield (admin only) |

**Sub-views (from Tools or other navigation):**
| Tab ID | Component | Parent |
|--------|-----------|--------|
| `tools` | `<Tools>` | (hub page) |
| `links-manager` | `<LinksManager>` | Back → tools |
| `time-manager` | `<TimeManager>` | Back → tools |
| `study-buddy` | `<StudyBuddy>` | Back → tools |
| `test` | `<Test>` | Back → subjects |

### 4.2 State Management — ALL IN `App.tsx` (No External Library)

All state lives in `App.tsx` via `useState` hooks and is **props-drilled** to children. Callback functions are passed as props for mutations.

#### Complete State Variables in `App.tsx`:

**Authentication & Session:**
| State | Type | Purpose |
|-------|------|---------|
| `session` | Session \| null | Supabase auth session |
| `showResetPasswordModal` | boolean | Password reset modal visibility |
| `resetPassword` / `confirmResetPassword` | string | Password reset form fields |
| `swUpdateWorker` | ServiceWorker \| null | New SW worker reference for updates |

**Student Profile/Settings:**
| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `caLevel` | string | 'Intermediate' | CA exam level |
| `studyTarget` | number | 6 | Daily study hours target |
| `totalHours` | number | 0 | Cumulative all-time study hours |
| `fullName` | string | '' | Display name |
| `examStartDate` | string | '' | Exam start date |
| `preparingFor` | string | 'Both Groups' | 'Group 1' / 'Group 2' / 'Both Groups' |

**Core Study Data:**
| State | Type | Purpose |
|-------|------|---------|
| `progressState` | ProgressState | **THE MAIN DATA STRUCTURE** — nested map of all subjects/chapters |
| `tests` | TestRecord[] | Test attempt results |
| `favouriteQuestions` | any[] | Bookmarked test questions |
| `dynamicPapers` | MockTestPaper[] | Mock papers fetched from Supabase |
| `globalSubjects` | any[] | Admin-managed subjects from Supabase |

**Study Tracking:**
| State | Type | Purpose |
|-------|------|---------|
| `todayHours` | number | Hours studied today (auto-resets daily) |
| `studyHistory` | Record<string, number> | `{ 'YYYY-MM-DD': hours }` map |
| `wakeHistory` | Record<string, string> | `{ 'YYYY-MM-DD': 'HH:MM' }` |
| `sleepHistory` | Record<string, string> | `{ 'YYYY-MM-DD': 'HH:MM' }` |
| `studyLogs` | StudyLog[] | Detailed log entries with id, date, hours, label |
| `selectedDate` | string | Currently selected date in planner |

**Streaks & Check-In:**
| State | Type | Purpose |
|-------|------|---------|
| `checkInHistory` | string[] | Array of 'YYYY-MM-DD' check-in dates |
| `checkedInToday` | boolean (useMemo) | Derived: today in checkInHistory? |
| `streakCount` | number (useMemo) | Derived: consecutive activity days |

**Planner Data:**
| State | Type | Purpose |
|-------|------|---------|
| `slots` | ScheduleSlot[] | Timetable schedule slots |
| `tasks` | Task[] | Planner task items |
| `revisions` | RevisionItem[] | Revision tracking items |
| `mistakes` | Mistake[] | Mistake log items |

**Subject Grouping:**
| State | Type | Purpose |
|-------|------|---------|
| `subjectGroups` | Record<string, 'Group 1' \| 'Group 2'> | Maps subject → exam group |

**UI State:**
| State | Type | Purpose |
|-------|------|---------|
| `activeTab` | string | Current navigation tab/view |
| `toast` | { message, type } \| null | Toast notification |
| `darkMode` | boolean | Dark mode toggle |
| `isTimerFullscreen` | boolean | Fullscreen timer overlay |
| `isChartFullscreen` | boolean | Fullscreen chart overlay |
| `stickyTimerVisible` | boolean | Floating mini-timer pill visible |

**Pomodoro Timer:**
| State | Type | Purpose |
|-------|------|---------|
| `timerTimeLeft` | number | Seconds remaining |
| `timerRunning` | boolean | Timer actively counting |
| `timerType` | 'focus' \| 'break' | Current timer mode |
| `timerPreset` | '25' \| '50' \| '5' | Duration preset (minutes) |
| `timerStudyLabel` | string | Custom label for session |

**Admin (Derived):**
| State | Type | Purpose |
|-------|------|---------|
| `isAdmin` | boolean (useMemo) | Checks email/metadata for admin status |

### 4.3 Key Data Structures (TypeScript Interfaces)

```typescript
// THE CORE DATA STRUCTURE — imported from ./components/Subjects
type ProgressState = Record<string, Record<string, {
  classDone: boolean;       // Chapter class completed
  priority: 'A' | 'B' | 'C'; // Priority level
  ldrs: boolean;            // Last Day Revision Sheet flag
  revisionCycle: number;    // 0, 1, 2, 3
  isCustom?: boolean;       // User-added chapter
  videoUrl?: string;        // Linked video URL
  ldrNotes?: string;        // LDR notes text
}>>;

// Study log entry — imported from ./components/Planner
interface StudyLog {
  id: string;
  date: string;        // 'YYYY-MM-DD'
  hours: number;
  label: string;       // e.g., "Subject - Chapter (Phase)" or "Pomodoro: label"
  timestamp: string;   // ISO timestamp
}

// Schedule slot — imported from ./components/Dashboard
interface ScheduleSlot {
  id: string;
  subject: string;
  chapter?: string;
  phase?: string;
  day?: string;
  timeStart?: string;
  timeEnd?: string;
  isCustomRange?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

// Mock test paper — imported from ./constants/mockTests
interface MockTestPaper {
  id: string;
  title: string;
  type: 'MCQ' | 'Subjective';
  totalMarks: number;
  questions: MCQQuestion[] | SubjectiveQuestion[];
  level: string;
  subject: string;
}

interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

interface SubjectiveQuestion {
  id: string;
  question: string;
  marks: number;
  suggestedAnswer: string;
}
```

### 4.4 Data Persistence — Dual Layer

**localStorage (primary, offline-first):**
Every state variable has a corresponding key. Key prefix: `cand_`.

```typescript
const LS_KEYS = {
  PROGRESS: 'cand_progress',
  CA_LEVEL: 'cand_caLevel',
  STUDY_TARGET: 'cand_studyTarget',
  TOTAL_HOURS: 'cand_totalHours',
  FULL_NAME: 'cand_fullName',
  SLOTS: 'cand_schedule_slots',
  TASKS: 'cand_planner_tasks',
  REVISIONS: 'cand_revisions',
  MISTAKES: 'cand_mistakes',
  EXAM_START_DATE: 'cand_examStartDate',
  TODAY_HOURS: 'cand_todayHours',
  TODAY_DATE_KEY: 'cand_todayDateKey',
  STREAK_COUNT: 'cand_streakCount',
  CHECKED_IN_TODAY: 'cand_checkedInToday',
};
// Plus: cand_studyHistory, cand_wakeHistory, cand_sleepHistory,
// cand_studyLogs, cand_checkInHistory, cand_subjectGroups,
// cand_preparingFor, cand_tests, cand_favourite_questions,
// cand_darkMode, cand_lastCheckInDate, cand_streak_migrated_v1
// Profile keys: cand_courseName, cand_attemptMonthYear, etc.
// Study Buddy: cand_study_buddies_v2, cand_study_groups_v2
// Links Manager: cand_links_manager_links
```

**Supabase Cloud (secondary, synced):**
- All state packed into single `progress_state` JSONB column in `user_progress` table
- Uses "packed" format with `checklist` key containing all substates
- 2-second debounced auto-save on ANY state change
- Cloud data **overrides** local data on login
- `is_active` field is NEVER sent from client (admin-only control)

### 4.5 Cloud Sync Flow

```
LOGIN:
  supabase.auth.onAuthStateChange → session obtained
  → loadCloudData(userId, email)
    → loadFromSupabase(userId) [from lib/syncProgress.ts]
    → Check is_active (force sign-out if false)
    → Unpack "checklist" key from progress_state
    → Override ALL local state with cloud data
    → Guard: hasSyncedRef prevents duplicate loads

AUTO-SAVE (every state change, 2s debounce):
  → Pack ALL state into progress_state JSONB
  → saveToSupabase(userId, userData) [upsert on user_id conflict]
  → Also saves ca_level, study_target, total_hours, email, full_name as columns

REALTIME SUBSCRIPTIONS:
  → mock_papers table: INSERT/UPDATE/DELETE → re-fetch papers, push notification
  → global_subjects table: changes → re-fetch, re-merge into SYLLABUS_DATA
```

---

## 5. Database Schema (Supabase)

### 5.1 Tables

#### `user_progress`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `user_id` | UUID (FK → auth.users, UNIQUE) | One row per user |
| `progress_state` | JSONB | **ALL app state** as packed JSON blob |
| `ca_level` | TEXT | "Foundation" / "Intermediate" / "Final" |
| `study_target` | INTEGER | Daily study hours goal |
| `total_hours` | NUMERIC | Cumulative study hours |
| `email` | TEXT | User's email |
| `full_name` | TEXT | User's display name |
| `is_active` | BOOLEAN (default true) | Account active status (admin-only) |
| `updated_at` | TIMESTAMPTZ | Last sync timestamp |

**RLS:** Users SELECT/INSERT/UPDATE own row. Admins SELECT/UPDATE all rows.

#### `mock_papers`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `level` | TEXT | CA level |
| `subject` | TEXT | Subject name |
| `title` | TEXT | Paper title |
| `type` | TEXT | "MCQ" or "Subjective" (CHECK constraint) |
| `total_marks` | INTEGER | Maximum marks |
| `questions` | JSONB | Array of question objects |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**RLS:** Public read. Admin-only write. Realtime enabled.

#### `global_subjects`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `level` | TEXT | CA level |
| `name` | TEXT | Subject name (or `__deleted_defaults__` sentinel) |
| `chapters` | JSONB | Array of chapter names |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**RLS:** Public read. Admin-only write. Realtime enabled.

### 5.2 Database Functions

#### `get_test_leaderboard(target_test_title TEXT)`
Returns ranked leaderboard for a specific MCQ test. Uses **latest attempt** per user. Ranking: percentage DESC → time ASC → date ASC. Returns: user_id, user_name, marks_obtained, total_marks, percentage, attempt_date, time_spent, rank.

### 5.3 Admin Identification (identical in SQL RLS and TypeScript)
```
is_admin = true (user_metadata JWT claim)
  OR email = 'chitranshagrawal005@gmail.com'
  OR email = 'admin@gmail.com'
  OR email LIKE '%@canextdoor.com'
```

---

## 6. Component Deep-Dive

### 6.1 `App.tsx` — Main Orchestrator (~2100 lines)

The monolithic heart. All state, all persistence, all routing.

**Key Functions:**
| Function | Line | Purpose |
|----------|------|---------|
| `loadFromStorage<T>()` | ~46 | Generic localStorage loader with fallback |
| `saveToStorage()` | ~56 | JSON.stringify wrapper for localStorage |
| `getLocalDateString()` | ~66 | Returns 'YYYY-MM-DD' for a Date |
| `getActivityDates()` | ~74 | Combines check-in/study/wake/sleep into date Set |
| `calculateStreak()` | ~116 | Computes consecutive-day streak backwards from today |
| `buildInitialProgress()` | ~149 | Constructs default ProgressState from SYLLABUS_DATA |
| `fetchDynamicPapers()` | ~234 | Fetches mock papers from Supabase |
| `fetchGlobalSubjects()` | ~295 | Fetches/merges admin subjects, handles `__deleted_defaults__` |
| `handleResetPasswordSubmit()` | ~651 | Password reset via Supabase |
| `showToast()` | ~647 | Sets toast notification state |
| `handleAddStudyHours()` | ~804 | Adds hours to totals, creates StudyLog entry |
| `handleTimerToggle/Reset/SelectPreset()` | ~876 | Pomodoro timer controls |
| `loadCloudData()` | ~962 | **CRITICAL**: Loads entire user state from Supabase on login |
| (auto-save effect) | ~1168 | 2s debounced saveToSupabase on any state change |
| `handleUpdateCaLevel/StudyTarget/FullName()` | ~1352 | Update profile + Supabase user metadata |
| `handleDeleteStudyLog()` | ~1405 | Deletes log, adjusts hours/history |
| `handleResetDailyTotal()` | ~1428 | Removes ALL logs for a date |
| `handleToggleClass()` | ~1449 | Toggles classDone boolean |
| `handleSetPriority()` | ~1471 | Sets priority A/B/C |
| `handleToggleLdrs()` | ~1493 | Toggles LDRS flag |
| `handleToggleRevisionCycle()` | ~1515 | Sets revision cycle number |
| `handleAddChapter()` | ~1543 | Adds custom chapter (isCustom: true) |
| `handleDeleteChapter()` | ~1562 | Deletes chapter, cleans revisions/mistakes |
| `handleAddSubject()` | ~1575 | Adds new subject + group assignment |
| `handleDeleteSubject()` | ~1595 | Deletes subject, cleans all related data |
| `handleSetVideoUrl()` | ~1611 | Sets video URL on chapter |
| `handleSetLdrNotes()` | ~1633 | Sets LDR notes and ldrs flag |
| `resetLocalState()` | ~1656 | Resets ALL state + clears all localStorage |
| `handleLogout()` | ~1702 | resetLocalState + clear session + reset sync flag |

**Level-Switching Logic (~L377-623):**
When `caLevel` changes:
- Prunes subjects from OTHER levels out of progressState, subjectGroups, slots, mistakes, revisions
- Prunes hardcoded "mock chapters" from progressState
- Adds missing subjects/chapters for current level
- Auto-assigns default subject groups (Group 1/2) for known subjects

**Realtime Subscriptions:**
- `mock_papers` table: INSERT/UPDATE/DELETE → re-fetch, push notification for matching level
- `global_subjects` table: changes → re-fetch, re-merge

**Special UI rendered by App.tsx:**
- Toast notifications (portal to `document.body`)
- Password reset modal (portal)
- Sticky floating mini-timer pill (persists across tabs)
- Service Worker update banner (portal)
- Schedule notification poller (every 30s, matches slot start times)

### 6.2 `Auth.tsx` (~300 lines)
- Email + Password auth via Supabase (`signInWithPassword` / `signUp`)
- Login/Signup toggle with animated form
- Full name field on signup (stored in `user_metadata`)
- Error handling with user-friendly messages
- Callback: `onAuthSuccess`

### 6.3 `Dashboard.tsx` (~1100 lines)
- Study streak display with check-in button
- Today's study hours vs target (progress ring)
- Schedule slots for today (timetable view)
- Quick action cards
- Recent study logs
- Wake/sleep time inputs
- Navigates to timer, test, planner, etc. via `onNavigate`

**Props received:** Extensive — caLevel, progressState, studyTarget, totalHours, todayHours, streakCount, checkedInToday, studyHistory, studyLogs, slots, tasks, subjectGroups, wakeHistory, sleepHistory, selectedDate, darkMode, + many callbacks

### 6.4 `Subjects.tsx` (~1100 lines)
- Lists all subjects for current CA level
- Each subject expands to show chapters
- **Chapter operations:** toggle classDone, set priority (A/B/C), toggle LDRS, cycle revision (0→1→2→3), add notes, set video URL
- Add/remove custom subjects and chapters
- Search/filter by name, filter by group
- Progress bar per subject
- Navigate to Test tab
- **Exports `ProgressState` type** — imported by App.tsx and others

### 6.5 `Test.tsx` (~2000 lines) — Most Complex Component
Three sub-views:

1. **Test List:** Browse mock papers filtered by level/subject/type. Shows past attempts.
2. **MCQ Test Engine:**
   - Timed countdown
   - Question navigation panel with mark-for-review
   - Auto-submit on time expiry
   - Tab-switch detection (anti-cheat/disqualification warning)
   - Instant scoring and result display
   - Answer review with correct/incorrect highlighting
   - Favourite/bookmark questions
3. **Subjective Test:** Timer + self-report marks
4. **Leaderboard:** Per-test via `get_test_leaderboard()` RPC. Rank, name, score, %, time.

### 6.6 `Planner.tsx` (~1800 lines)
- **Calendar view** with date selector
- **Study logs** for selected date with add/edit/delete
- **Pomodoro timer** integration (start from planner)
- **Task management** with checkboxes
- **Timetable slots** management
- **Wake/sleep time** tracking per date
- **Daily totals** with reset option
- **Exports `Task`, `StudyLog` types**

### 6.7 `Analytics.tsx` (~1200 lines)
- **Revision tracker:** Track revision cycles per chapter
- **Mistake journal:** Log mistakes by subject/chapter with notes
- Revision statistics and completion rates
- **Exports `RevisionItem`, `Mistake` types**

### 6.8 `AdminPanel.tsx` (~1800 lines)
Three sections:

1. **Subject Management:** CRUD for `global_subjects`. Supports `__deleted_defaults__` sentinel to hide built-in subjects. Per-level management.
2. **Mock Paper Management:** CRUD for `mock_papers`. Question editor (MCQ options + correct answer + explanation). Import/Export JSON. Set marks, time limits.
3. **User Management:** View all users with stats. Activate/deactivate (`is_active`). View individual progress. Export to Excel (xlsx).

### 6.9 `StudyBuddy.tsx` (~1100 lines)
- **Buddy system:** Add buddies via deterministic share codes (`CA-{NAME}{ID}`)
- **Groups:** Create (`GRP-` codes), Join, Add members, Delete/Leave
- **Leaderboard:** Ranks members by weighted completion (1.5× for Group 1/2 subjects)
- **Weighted progress formula:** Each chapter = 4 points max (1 classDone + 3 revisionCycles)
- **Realtime:** Supabase subscription on `user_progress` for live buddy status
- Resolves buddy codes by querying `user_progress` table
- Modal sheets via `createPortal`
- Persisted in localStorage (`cand_study_buddies_v2`, `cand_study_groups_v2`)

### 6.10 `TimeManager.tsx` (~323 lines)
- **NOT a timer** — it's a time allocation ANALYSIS tool
- Parses `studyLogs` to show hours per chapter broken down by phase (Class, R1, R2, R3)
- Regex patterns to extract subject/chapter/phase from log labels:
  - `"Subject - Chapter (Phase)"` format
  - `"Subject (Phase)"` format
  - `"Subject • Chapter"` format
  - Strips `Pomodoro:` prefix
- Per-subject tab bar, chapter search, table view

### 6.11 `Profile.tsx` (~596 lines)
- Display/edit full name, CA level, study target
- Exam start date, preparing for (Group 1/2/Both)
- **Articleship tracking:** start date, allowed/taken leaves, time elapsed, balance computation
- Password change via `supabase.auth.updateUser()`
- PWA notification permission request
- Sign-out via `supabase.auth.signOut()`
- Uses `CustomSelect` for course level dropdown
- All profile fields persisted in localStorage with `cand_` prefix

### 6.12 `Tools.tsx` (~82 lines)
- Navigation hub with 3 tool cards:
  1. Links Manager (`links-manager`)
  2. Time Manager (`time-manager`)
  3. Study Buddy & Groups (`study-buddy`)
- "Coming soon" banner
- Calls `onOpenTool(toolId)` → parent sets `activeTab`

### 6.13 `LinksManager.tsx` (~461 lines)
- Bookmark study URLs organized by category
- CRUD: Add, Edit, Delete (inline confirmation)
- Default categories: Lectures, Reference, Revision Notes, Other
- Auto-collects dynamic categories from saved links
- URL auto-formatting (prepends `https://`)
- Domain extraction for display
- Search + category tab filter
- Modal via `createPortal`
- Stored in `localStorage` key `cand_links_manager_links`

### 6.14 `BottomNav.tsx` (~48 lines)
- 5 main tabs: home, subjects, planner, analytics, profile
- Conditional admin tab (Shield icon) when `isAdmin` is true
- Active tab dot indicator
- Icons: Home, BookOpen, Calendar, BarChart2, User, Shield

### 6.15 `CustomSelect.tsx` (~72 lines)
- Reusable styled dropdown replacing native `<select>`
- Supports `string[]` or `{value, label}[]` options
- Click-to-open popover, overlay for outside-click dismiss
- Used by Profile.tsx

---

## 7. Styling & Design System

### 7.1 CSS Variables (`:root`)
```css
--bg-primary: #FAF2DB;          /* Warm cream/beige */
--bg-secondary: #F3EAD0;        /* Soft warm sand */
--bg-card: #FFFFFF;              /* White cards */
--bg-card-hover: #FAF7EF;       /* Warm hover */
--border-color: #D2C4A2;         /* Warm outline border */
--accent-primary: #6366f1;       /* Indigo (BRAND COLOR) */
--accent-secondary: #0ea5e9;     /* Sky blue */
--accent-cyan: #06b6d4;
--accent-gold: #d97706;          /* Amber */
--accent-red: #ef4444;
--accent-green: #10b981;
--text-primary: #0f172a;         /* Deep slate */
--text-secondary: #475569;
--text-muted: #94a3b8;
--font-display: 'Outfit';
--font-body: 'Plus Jakarta Sans';
```

### 7.2 Design Characteristics
- **Light mode** with warm cream/beige theme (has dark mode toggle but light is default)
- **Mobile-first** PWA (portrait orientation)
- Cards with white backgrounds, warm borders, subtle shadows
- Bottom nav fixed with safe-area handling
- Hidden scrollbars
- CSS keyframe animations (fadeIn, slideUp, pulse, etc.)
- All CSS in single `index.css` (~11,700 lines)

### 7.3 Layout Pattern
```
┌─────────────────────┐
│  .app-shell-wrapper  │  ← Full viewport (100dvh)
│  ┌─────────────────┐│
│  │  .screen-content ││  ← Scrollable (flex: 1, overflow-y: auto)
│  │                  ││     padding-bottom: 72px + safe-area
│  │  (active tab)    ││
│  │                  ││
│  └─────────────────┘│
│  ┌─────────────────┐│
│  │  .bottom-nav     ││  ← Fixed at bottom
│  └─────────────────┘│
└─────────────────────┘
```

### 7.4 CSS Naming Convention
- BEM-like with component prefix: `.auth-*`, `.dashboard-*`, `.test-*`, `.admin-*`, `.planner-*`, `.analytics-*`, `.subjects-*`, `.profile-*`, `.study-buddy-*`, `.links-*`, `.time-manager-*`
- No CSS modules or CSS-in-JS

---

## 8. PWA Configuration

### Manifest (`public/manifest.json`)
- `display: "standalone"`, `orientation: "portrait"`
- `theme_color: "#6366F1"`, `background_color: "#0B0F19"`
- Single icon: `logo.png` (512x512, `any maskable`)

### Service Worker (`public/sw.js`)
- **Stale-While-Revalidate** for cached assets
- Caches: `/`, `/index.html`, `/manifest.json`, `/logo.png`
- **Excludes** Supabase API calls from caching
- Version stamped via `update-sw-version.js` on each build
- Handles `SKIP_WAITING` message from client
- Handles `notificationclick` (focuses/opens app)

### Update Flow
1. `update-sw-version.js` stamps `sw.js` with `ca-next-door-v{ISO_TIMESTAMP}` on build
2. `main.tsx` checks for SW updates on load + every 5 minutes
3. New SW detected → dispatches `sw-update-available` custom event
4. `App.tsx` shows update banner → user clicks "Update Now" → `SKIP_WAITING` → page reload

### Push Notifications
- Timer completion, study slot starting, new mock paper uploaded
- Vibration pattern: `[200, 100, 200]`
- Schedule slot checker runs every 30 seconds in `App.tsx`

---

## 9. Constants & Default Data

### `constants/syllabus.ts`
```typescript
SYLLABUS_DATA = {
  Final: {
    'Paper 1: Financial Reporting': string[35],    // 35 chapters
    'Paper 2: Advanced Financial Management': string[15],
    'Paper 3: Advanced Auditing and Assurance': string[19],
    'Paper 4: Direct Tax and International Taxation': string[27],
    'Paper 5: Indirect Taxation and Customs': string[31],
  },
  Intermediate: {
    'Advanced Accounting': [],        // Empty (populated via global_subjects)
    'Corporate & Other Laws': [],
    'Taxation (DT & IDT)': [],
    'Cost & Management Accounting': [],
  },
  Foundation: {
    'Principles & Practice of Accounting': [],
    'Business Laws': [],
    'Quantitative Aptitude': [],
    'Business Economics': [],
  }
}
```
- **CA Final** has fully populated chapters (127 total)
- **Intermediate/Foundation** have subject names only (chapters come from Supabase `global_subjects`)

### `constants/mockTests.ts`
- Type definitions: `MCQQuestion`, `SubjectiveQuestion`, `MockTestPaper`
- `MOCK_TESTS_DATA` — empty placeholder (actual data comes from Supabase `mock_papers`)

---

## 10. Utility Files

### `lib/syncProgress.ts`
- `loadFromSupabase(userId)` → reads `user_progress` row, handles PGRST116 (no row)
- `saveToSupabase(userId, userData)` → upserts on `user_id` conflict, sets `updated_at`, **excludes `is_active`**
- Exports `UserData` interface

### `supabaseClient.ts`
- Creates client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- Falls back to placeholder client if env vars missing
- Debug logging

### `update-sw-version.js`
- Reads `public/sw.js`, replaces `CACHE_NAME` with timestamped version
- Run as part of `npm run build` command

---

## 11. Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public API key |

> **Note:** Gemini API key (for Study Buddy's AI chat, if it uses one) and other user-specific keys are stored in **localStorage** by the user, not in env vars.

---

## 12. Build & Development

| Command | Action |
|---------|--------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | `update-sw-version.js` → `tsc -b` → `vite build` → `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

---

## 13. Development Patterns & Conventions

### When Adding a New Feature:
1. Add state variable(s) in `App.tsx`
2. Add corresponding `LS_KEYS` entry and `useEffect` for localStorage persistence
3. Include in the packed `progress_state` blob in the auto-save effect (~L1168)
4. Include in `loadCloudData()` unpacking logic (~L962)
5. Create component in `src/components/`
6. Add navigation: either in `Tools.tsx` (as a tool) or `BottomNav.tsx` (as a main tab)
7. Add tab case in `App.tsx` render switch (~L1709)
8. Add CSS classes in `src/index.css` with component prefix
9. If admin-managed: add Supabase table + RLS + AdminPanel section

### When Modifying Existing Components:
- Props come from `App.tsx` — check the component's props interface
- State mutations go through callbacks defined in `App.tsx`
- CSS lives in `src/index.css` — search by component prefix
- Some components export types used by App.tsx (e.g., `ProgressState`, `StudyLog`, `Task`, `RevisionItem`, `Mistake`, `ScheduleSlot`, `TestRecord`)

### Common Pitfalls:
- `progress_state` JSONB can be VERY large — full object read/write every 2 seconds
- `index.css` is ~11,700 lines — search carefully for duplicate class names
- `App.tsx` is ~2100 lines — use line references when navigating
- Components like `Test.tsx` (~2000 lines) and `Planner.tsx` (~1800 lines) have complex internal state machines
- Admin email checks are hardcoded in BOTH SQL (RLS) and TypeScript — keep in sync
- Service Worker caching can cause confusion during dev — use incognito or hard refresh
- `__deleted_defaults__` sentinel in `global_subjects` is a special record for hiding built-in subjects
- `is_active` is NEVER sent from client to prevent users from re-activating themselves
- Level-switching prunes data aggressively — subjects from other levels get removed from progressState
- The "packed" format with `checklist` key is the NEW format; old format (just progressState) is still supported for backwards compat in `loadCloudData`
- `StudyBuddy` queries OTHER users' `user_progress` rows — RLS must allow this (admin policies or special logic)
- `TimeManager` is NOT a timer — it's analytics. The actual timer is the Pomodoro system in `App.tsx`/`Planner.tsx`

---

## 14. File Size Reference

| File | Size | Lines |
|------|------|-------|
| `src/index.css` | 235 KB | ~11,700 |
| `src/App.tsx` | 80 KB | ~2,100 |
| `src/components/Test.tsx` | 72 KB | ~2,000 |
| `src/components/AdminPanel.tsx` | 67 KB | ~1,800 |
| `src/components/Planner.tsx` | 67 KB | ~1,800 |
| `src/components/StudyBuddy.tsx` | 44 KB | ~1,100 |
| `src/components/Analytics.tsx` | 42 KB | ~1,200 |
| `src/components/Subjects.tsx` | 40 KB | ~1,100 |
| `src/components/Dashboard.tsx` | 39 KB | ~1,100 |
| `src/components/Profile.tsx` | 23 KB | ~596 |
| `src/components/LinksManager.tsx` | 16 KB | ~461 |
| `src/components/TimeManager.tsx` | 12 KB | ~323 |
| `src/components/Auth.tsx` | 10 KB | ~300 |
| `src/constants/syllabus.ts` | 6 KB | ~157 |
| `src/components/Tools.tsx` | 2.6 KB | ~82 |
| `src/lib/syncProgress.ts` | 2.3 KB | ~79 |
| `src/components/CustomSelect.tsx` | 2 KB | ~72 |
| `src/components/BottomNav.tsx` | 1.4 KB | ~48 |
| `src/constants/mockTests.ts` | 596 B | ~29 |
