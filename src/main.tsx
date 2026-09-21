import { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight, Bell, CalendarDays, Check, ChevronDown,
  Lightbulb, ListChecks, MessageCircle, Plus, Send, Settings2,
  Star, Trophy, Users, Vote, X, LogOut,
} from 'lucide-react'
import { api, type ApiParty, type ApiSuggestion, type ApiTeacher, type ApiVote } from './api'
import './styles.css'

type Party = ApiParty
type Suggestion = ApiSuggestion
type Teacher = ApiTeacher
type NewTeacher = { name: string; subject: string; color: string; image?: string; login: string; password: string }
type VoteLogEntry = ApiVote
type VisitorDay = { date: string; count: number }

function getTodayDeadline() {
  // Har kuni soat 20:00 da ovoz berish yakunlanadi (kunlik yangilanadi)
  const end = new Date()
  end.setHours(20, 0, 0, 0)
  if (end.getTime() <= Date.now()) end.setDate(end.getDate() + 1)
  return end.getTime()
}

// Faqat qurilmaga xos shaxsiy holat (men ovoz berdimmi, kim sifatida kirganman).
// Umumiy ma'lumotlar serverdan keladi.
function useSavedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) as T : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}

// Brauzerga bir marta beriladigan barqaror ID (kunlik tashrifni sanash uchun).
function getVisitorId() {
  let id = localStorage.getItem('time-school-visitor-id')
  if (!id) {
    id = 'v-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('time-school-visitor-id', id)
  }
  return id
}

function App() {
  const adminRoute = window.location.pathname === '/admin'
  const teacherRoute = window.location.pathname === '/teacher'
  const [mode, setMode] = useState<'student' | 'admin' | 'teacher'>(adminRoute ? 'admin' : teacherRoute ? 'teacher' : 'student')
  const [isAdminAuthed, setIsAdminAuthed] = useSavedState('time-school-admin-auth', false)
  const [isTeacherAuthed, setIsTeacherAuthed] = useSavedState('time-school-teacher-auth', false)
  const [showLogin, setShowLogin] = useState(adminRoute && !isAdminAuthed)
  const [showTeacherLogin, setShowTeacherLogin] = useState(teacherRoute && !isTeacherAuthed)
  const [showTeacherForm, setShowTeacherForm] = useState(false)
  // --- Serverdan keladigan umumiy ma'lumotlar (hamma qurilmada bir xil) ---
  const [parties, setParties] = useState<Party[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [voteLog, setVoteLog] = useState<VoteLogEntry[]>([])
  const [visitorHistory, setVisitorHistory] = useState<VisitorDay[]>([])
  const [partyVotingOpen, setPartyVotingOpen] = useState(true)
  const [deadlineServer, setDeadlineServer] = useState<number>(0)
  const [serverReady, setServerReady] = useState(false)
  const [serverError, setServerError] = useState('')
  // --- Faqat shu qurilmaga xos holat ---
  const [selectedParty, setSelectedParty] = useSavedState<number | null>('time-school-selected-party', null)
  const [voted, setVoted] = useSavedState('time-school-voted', false)
  const [teacherRated, setTeacherRated] = useSavedState('time-school-teacher-rated', false)
  const [teacherPanelName, setTeacherPanelName] = useSavedState('time-school-teacher-panel', '')
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [suggestionText, setSuggestionText] = useState('')
  const [suggestionTeacher, setSuggestionTeacher] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [rating, setRating] = useState(0)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [profileTeacher, setProfileTeacher] = useState<Teacher | null>(null)
  const [now, setNow] = useState(Date.now())
  const [visitorCount, setVisitorCount] = useState(0)
  // Ovoz berishda o'quvchi tanlagan ustoz va kiritgan ismi
  const [voteTeacher, setVoteTeacher] = useState('')
  const [voteName, setVoteName] = useSavedState('time-school-student-name', '')
  const [votedParty, setVotedParty] = useSavedState<string>('time-school-voted-party', '')

  // Bugungi sana kaliti (har kuni avtomatik yangilanadi)
  const todayKey = new Date().toISOString().slice(0, 10)

  // Kunlik vaqtinchalik muddat (server bergan deadline — faqat ko'rsatish uchun)
  const d0 = getTodayDeadline()
  const deadline = deadlineServer || d0
  // Serverdan holatni olib kelish
  const refresh = useCallback(async () => {
    try {
      const s = await api.state()
      setParties(s.parties)
      setTeachers(s.teachers)
      setSuggestions(s.suggestions)
      setVoteLog(s.votes.map((v) => ({ ...v, teacher: v.teacher || '' })))
      setVisitorHistory(s.visitorDays)
      setPartyVotingOpen(s.votingOpen)
      setDeadlineServer(s.deadline)
      setServerError('')
      setServerReady(true)
    } catch (e) {
      setServerError('Server bilan aloqa yo\'q. Server ishlayaptimi? (npm run dev)')
      setServerReady(true)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // REAL VAQT: har 4 sekundda serverdan yangi holatni olamiz.
  // Shunday qilib boshqa qurilmalardagi o'zgarishlar (ovoz, ustoz, taklif)
  // sahifani yangilamasdan ham ko'rinadi.
  useEffect(() => {
    const timer = window.setInterval(() => { refresh() }, 4000)
    return () => window.clearInterval(timer)
  }, [refresh])

  // Sahifa ochilganda serverdan "men ovoz berdimmi" ni tekshiramiz.
  // Shunda boshqa qurilmada/qayta kirganda ham holat to'g'ri tiklanadi.
  useEffect(() => {
    if (!serverReady) return
    let cancelled = false
    api.myVote(getVisitorId())
      .then((r) => {
        if (cancelled) return
        if (r.voted && r.vote) {
          setVoted(true)
          setVotedParty(r.vote.party)
          setVoteTeacher(r.vote.teacher)
          const found = parties.find((p) => p.title === r.vote!.party)
          if (found) setSelectedParty(found.id)
        } else {
          // Server "ovoz yo'q" desa (masalan admin ovozlarni tozalagan bo'lsa),
          // brauzerdagi eski holatni ham tozalaymiz — qayta ovoz bera olsin.
          setVoted(false)
          setVotedParty('')
          setSelectedParty(null)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverReady])

  // Bugungi kun ovozlari soni (serverdagi bugungi yozuvlardan hisoblanadi)
  const dailyVotes = useMemo(() => voteLog.filter((v) => new Date(v.time).toISOString().slice(0, 10) === todayKey).length, [voteLog, todayKey])

  // Tashrifni serverga yozamiz — bir brauzer kuniga 1 marta sanaladi
  useEffect(() => {
    let cancelled = false
    api.visitorHit(getVisitorId(), todayKey)
      .then((r) => { if (!cancelled) setVisitorCount(r.count) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [todayKey])

  // "Men ovoz berdimmi" holatini ham vaqti-vaqti bilan yangilab turamiz.
  useEffect(() => {
    if (!serverReady) return
    let cancelled = false
    const sync = async () => {
      try {
        const r = await api.myVote(getVisitorId())
        if (cancelled) return
        if (r.voted && r.vote) {
          setVoted(true)
          setVotedParty(r.vote.party)
        } else {
          // Ovozlar tozalangan bo'lsa, brauzer holatini ham yangilaymiz.
          setVoted(false)
          setVotedParty('')
        }
      } catch { /* server vaqtincha javob bermadi */ }
    }
    const timer = window.setInterval(sync, 6000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [serverReady])

  useEffect(() => {
    const handleTeacherAction = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (mode === 'admin' && target.closest('.admin-heading .primary')) setShowTeacherForm(true)
    }
    document.addEventListener('click', handleTeacherAction)
    return () => document.removeEventListener('click', handleTeacherAction)
  }, [mode])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // Admin ovoz holatini o'zgartirganda serverga yoziladi.
  const setVotingState = async (open: boolean) => {
    setPartyVotingOpen(open)
    try { await api.setVoting(open) } catch { setServerError('Holatni saqlashda xatolik.') }
  }

  // Reyting endi serverdagi teacher.rating'dan olinadi (hamma uchun umumiy)
  const teacherRatings = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    teachers.forEach((t) => { if (t.rating) map[t.name] = t.rating })
    return map
  }, [teachers])

  const seconds = Math.max(0, Math.floor((deadline - now) / 1000))

  const countdown = useMemo(() => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return [days, hours, minutes, secs]
  }, [seconds])

  const vote = async (id: number) => {
    if (voted || !partyVotingOpen || !voteTeacher || !voteName.trim()) return
    setSelectedParty(id)
    setShowSuccess(true)
    const chosen = parties.find((p) => p.id === id)
    try {
      await api.vote(id, voteName.trim(), voteTeacher, getVisitorId())
      setVoted(true)
      setVotedParty(chosen?.title || '')
      await refresh()
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'already_voted') {
        setVoted(true)
        setServerError('Siz allaqachon ovoz bergansiz. Bir o\'quvchi faqat bir marta ovoz bera oladi.')
      } else {
        setServerError('Ovozni saqlashda xatolik. Server ishlayaptimi?')
      }
    }
  }

  const submitSuggestion = async () => {
    if (!suggestionText.trim() || !suggestionTeacher.trim()) return
    setSuggestionText('')
    setSuggestionTeacher('')
    setShowSuggestion(false)
    setShowSuccess(true)
    try {
      await api.addSuggestion({ text: suggestionText.trim(), teacher: suggestionTeacher, author: "Anonim o'quvchi" })
      await refresh()
    } catch {
      setServerError('Taklifni saqlashda xatolik. Server ishlayaptimi?')
    }
  }

  const submitRating = async (submittedRating = rating) => {
    if (!selectedTeacher || !submittedRating || teacherRated) return
    const found = teachers.find((item) => item.name === selectedTeacher)
    setSelectedTeacher('')
    setRating(0)
    setTeacherRated(true)
    setShowSuccess(true)
    if (found) {
      try {
        await api.rateTeacher(found.id, submittedRating)
        await refresh()
      } catch {
        setServerError('Bahoni saqlashda xatolik. Server ishlayaptimi?')
      }
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <nav className="topbar glass-panel">
        <div className="brand"><div className="school-logo"><span className="logo-t">T</span><span className="logo-s">S</span></div><span>TIME <b>SCHOOL</b> <span>PARTY</span></span></div>
        <div className="topbar-right" />
      </nav>

      {serverError && <div className="server-banner glass-panel"><span>⚠️ {serverError}</span><button onClick={() => { setServerError(''); refresh() }}>Qayta urinish</button></div>}
      {!serverReady && <div className="content"><p className="muted" style={{ textAlign: 'center', padding: '40px 0' }}>Yuklanmoqda...</p></div>}

      {mode === 'teacher' ? (
        isTeacherAuthed
          ? <TeacherPanel teachers={teachers} teacherName={teacherPanelName} onSelectTeacher={setTeacherPanelName} suggestions={suggestions} voteLog={voteLog} teacherRatings={teacherRatings} onExit={() => { setIsTeacherAuthed(false); setMode('student'); window.history.pushState({}, '', '/') }} />
          : null
      ) : mode === 'student' ? (
        <StudentView countdown={countdown} parties={parties} teachers={teachers} selectedParty={selectedParty} voted={voted} votedParty={votedParty} partyVotingOpen={partyVotingOpen} deadline={deadline} vote={vote} voteTeacher={voteTeacher} onVoteTeacher={setVoteTeacher} voteName={voteName} onVoteName={setVoteName} onSuggest={() => setShowSuggestion(true)} onRate={(name) => setSelectedTeacher(name)} onProfile={setProfileTeacher} teacherRatings={teacherRatings} teacherRated={teacherRated} />
      ) : (
        <><AdminView parties={parties} suggestions={suggestions} teachers={teachers} teacherRatings={teacherRatings} deadline={deadline} visitorCount={visitorCount} visitorHistory={visitorHistory} dailyVotes={dailyVotes} voteLog={voteLog} votingOpen={partyVotingOpen} onToggleVoting={() => setVotingState(!partyVotingOpen)} onResetVotes={async () => { try { await api.resetVotes() } catch { setServerError('Server xatosi.') }; setVoted(false); setSelectedParty(null); await refresh() }} onSetParty={async (text) => { try { await api.addParty(text) } catch { setServerError('Server xatosi.') }; await refresh() }} onAddTeacher={async (teacher) => { try { await api.addTeacher(teacher) } catch (e) { setServerError('Bu login band bo\'lishi mumkin.') }; await refresh() }} /><TeacherDiagram teachers={teachers} teacherRatings={teacherRatings} onEdit={setEditingTeacher} onRate={async (name, value) => { const t = teachers.find((x) => x.name === name); if (t) { try { await api.rateTeacher(t.id, value) } catch { setServerError('Server xatosi.') }; await refresh() } }} /><button className="logout-button" onClick={() => { setIsAdminAuthed(false); setMode('student'); window.history.pushState({}, '', '/') }}><LogOut size={15} /> Admin paneldan chiqish</button></>
      )}

      {showLogin && <AdminLogin onClose={() => { setShowLogin(false); setMode('student'); window.history.pushState({}, '', '/') }} onLogin={() => { setIsAdminAuthed(true); setMode('admin'); setShowLogin(false) }} />}
      {showTeacherLogin && <TeacherLogin onClose={() => { setShowTeacherLogin(false); setMode('student'); window.history.pushState({}, '', '/') }} onLogin={(name) => { setIsTeacherAuthed(true); setTeacherPanelName(name); setMode('teacher'); setShowTeacherLogin(false) }} />}
      {showTeacherForm && <TeacherDialog onClose={() => setShowTeacherForm(false)} onSubmit={async (teacher) => {
        try {
          await api.addTeacher(teacher)
        } catch (e) {
          const code = (e as { code?: string }).code
          await refresh()
          if (code === 'exists') return 'Bu login yoki ism allaqachon band.'
          return 'Ustozni qo\'shishda xatolik. Qayta urinib ko\'ring.'
        }
        setShowTeacherForm(false)
        setShowSuccess(true)
        await refresh()
        return null
      }} />}
      {editingTeacher && <TeacherDialog initialTeacher={editingTeacher} onClose={() => setEditingTeacher(null)} onSubmit={async (teacher) => {
        try {
          await api.updateTeacher(editingTeacher.id, teacher)
        } catch (e) {
          const code = (e as { code?: string }).code
          await refresh()
          if (code === 'login_taken') return 'Bu login boshqa ustozda band.'
          if (code === 'name_taken') return 'Bu ism boshqa ustozda band.'
          if (code === 'missing_fields') return 'Ism, login va parolni kiriting.'
          return 'Saqlashda xatolik. Qayta urinib ko\'ring.'
        }
        setEditingTeacher(null)
        setShowSuccess(true)
        await refresh()
        return null
      }} />}
      {showSuggestion && <SuggestionDialog teachers={teachers} teacher={suggestionTeacher} text={suggestionText} onTeacher={setSuggestionTeacher} onText={setSuggestionText} onClose={() => setShowSuggestion(false)} onSubmit={submitSuggestion} />}
      {selectedTeacher && <RatingDialog teacher={selectedTeacher} onClose={() => setSelectedTeacher('')} onSubmit={(value) => { setRating(value); submitRating(value) }} />}
      {profileTeacher && <TeacherProfile teacher={profileTeacher} suggestions={suggestions} votes={teacherRatings[profileTeacher.name] || 0} onClose={() => setProfileTeacher(null)} />}
      {showSuccess && <div className="toast glass-panel"><div className="toast-check"><Check size={15} /></div><div><strong>Rahmat, qabul qilindi!</strong><small>Admin taklifingizni ko'rib chiqadi.</small></div><button onClick={() => setShowSuccess(false)}><X size={15} /></button></div>}
    </main>
  )
}

function TeacherPanel({ teachers, teacherName, onSelectTeacher, suggestions, voteLog, teacherRatings, onExit }: { teachers: Teacher[]; teacherName: string; onSelectTeacher: (name: string) => void; suggestions: Suggestion[]; voteLog: VoteLogEntry[]; teacherRatings: Record<string, number>; onExit: () => void }) {
  const current = teachers.find((item) => item.name === teacherName) || null
  if (!current) {
    return <div className="content teacher-panel"><div className="teacher-login glass-panel"><p className="eyebrow">O'QITUVCHI PANELI</p><h1>Kim sifatida kirdingiz?</h1><p className="muted">O'z ismingizni tanlang va shaxsiy panelni ko'ring.</p><div className="teacher-choice">{teachers.map((teacher) => <button key={teacher.name} className="teacher-choice-item" onClick={() => onSelectTeacher(teacher.name)}><div className="teacher-avatar">{teacher.image ? <img src={teacher.image} alt="" /> : teacher.initials}</div><div><strong>{teacher.name}</strong><small>{teacher.subject}</small></div></button>)}</div></div></div>
  }
  const mySuggestions = suggestions.filter((item) => item.teacher === current.name)
  const myRating = teacherRatings[current.name] || current.rating || 0
  // Faqat shu ustoz tanlangan ovozlar ko'rinadi
  const myVotes = voteLog.filter((entry) => entry.teacher === current.name)
  const myVoters = myVotes.length
  return <div className="content teacher-panel"><div className="teacher-panel-head glass-panel"><div className="teacher-avatar profile-avatar">{current.image ? <img src={current.image} alt="" /> : current.initials}</div><div><p className="eyebrow">O'QITUVCHI PANELI</p><h1>{current.name}</h1><small className="muted">{current.subject}</small></div><button className="logout-button" onClick={onExit}><LogOut size={15} /> Chiqish</button></div><section className="stats-grid"><div className="stat-card glass-panel"><div className="stat-icon yellow"><Star size={18} /></div><small>Mening reytingim</small><strong>{myRating ? myRating.toFixed(1) : '0.0'}</strong></div><div className="stat-card glass-panel"><div className="stat-icon blue"><Lightbulb size={18} /></div><small>O'quvchilar takliflari</small><strong>{mySuggestions.length}</strong></div><div className="stat-card glass-panel"><div className="stat-icon coral"><Vote size={18} /></div><small>Meni tanlagan o'quvchilar</small><strong>{myVoters} ta</strong></div></section><section className="dashboard-card glass-panel"><div className="section-head compact"><div><p className="eyebrow">PARTY'LAR BO'YICHA</p><h2>Qaysi party'ga ovoz berilgan</h2></div><Vote size={18} /></div>{myVotes.length === 0 ? <p className="muted notif-empty">Hozircha ovoz yo'q.</p> : <div className="teacher-party-stats">{[...new Set(myVotes.map((v) => v.party))].map((partyName) => { const count = myVotes.filter((v) => v.party === partyName).length; return <div className="teacher-party-row" key={partyName}><span className="party-stat-name">🎉 {partyName}</span><span className="party-stat-count">{count} ta ovoz</span><div className="party-stat-bar"><span style={{ width: `${Math.round(count / myVotes.length * 100)}%` }} /></div></div> })}</div>}</section><section className="dashboard-card glass-panel submissions"><div className="section-head compact"><div><p className="eyebrow">O'QUVCHILARIM</p><h2>Taklif bergan o'quvchilar</h2></div><Lightbulb size={18} /></div>{mySuggestions.length === 0 ? <p className="muted notif-empty">Hozircha o'quvchilar taklif bermagan.</p> : <div className="people-table">{mySuggestions.map((item) => <div className="table-row suggestion-table" key={item.text}><span><div className="small-avatar">{item.author.split(' ').map((x) => x[0]).join('').slice(0, 2)}</div><strong>{item.author}</strong></span><span><Lightbulb size={14} /> {item.text}</span><small className="muted">{item.status}</small></div>)}</div>}</section><section className="dashboard-card glass-panel submissions"><div className="section-head compact"><div><p className="eyebrow">MENI TANLAGAN O'QUVCHILAR</p><h2>Kim qaysi party'ga ovoz berdi</h2></div><Vote size={18} /></div>{myVotes.length === 0 ? <p className="muted notif-empty">Hozircha sizni tanlagan o'quvchi yo'q.</p> : <div className="people-table"><div className="table-row table-head"><span>O'quvchi (ismi)</span><span>Ovoz bergan party</span><span>Vaqti</span></div>{myVotes.map((entry) => <div className="table-row" key={entry.time}><span><div className="small-avatar">{entry.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</div><strong>{entry.name}</strong></span><span>🎉 {entry.party}</span><span className="muted">{new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(entry.time)}</span></div>)}</div>}</section></div>
}

function StudentView({ countdown, parties, teachers, selectedParty, voted, votedParty, partyVotingOpen, deadline, vote, voteTeacher, onVoteTeacher, voteName, onVoteName, onSuggest, onRate, onProfile, teacherRatings, teacherRated }: { countdown: number[]; parties: Party[]; teachers: Teacher[]; selectedParty: number | null; voted: boolean; votedParty: string; partyVotingOpen: boolean; deadline: number; vote: (id: number) => void; voteTeacher: string; onVoteTeacher: (name: string) => void; voteName: string; onVoteName: (value: string) => void; onSuggest: () => void; onRate: (name: string) => void; onProfile: (teacher: Teacher) => void; teacherRatings: Record<string, number>; teacherRated: boolean }) {
  const rankedTeachers = [...teachers].sort((first, second) => (teacherRatings[second.name] || second.rating || 0) - (teacherRatings[first.name] || first.rating || 0))
  return <div className="content student-content">
    <section className="hero-row"><div><p className="eyebrow"><span className="live-dot" /> TIME PARTY · MAYDON</p><h1>Keyingi party'ni<br /><em>birgalikda tanlaymiz.</em></h1><p className="hero-copy">Sizning ovozingiz markazimizdagi keyingi unutilmas kunni yaratadi.</p></div><div className="next-event glass-panel"><div className="event-head"><span><CalendarDays size={15} /> Ovoz berish yopilishigacha</span><span className="pill-live">LIVE</span></div><div className="countdown">{countdown.map((value, i) => <div className="time-cell" key={i}><strong>{String(value).padStart(2, '0')}</strong><small>{['KUN', 'SOAT', 'MIN', 'SEK'][i]}</small></div>)}</div><div className="progress"><span /></div><small className="muted">{new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'long' }).format(deadline)} · 20:00 da yakunlanadi</small></div></section>
    <section className="section-head"><div><p className="eyebrow">OVOZ BERISH</p><h2>Qaysi biri bo'lsin?</h2></div><span className="vote-count"><Users size={15} /> {voted ? `${parties.reduce((a, b) => a + b.votes, 0)} ta ovoz` : 'Natija ovoz berilgandan keyin'}</span></section>
    {!partyVotingOpen && <div className="closed-banner glass-panel"><Check size={17} /><span><strong>Ovoz berish yopildi</strong><small>Sizning tanlovingiz qabul qilindi. Keyingi ovoz berish yangi party bilan ochiladi.</small></span></div>}
    {!voted && partyVotingOpen && <div className="vote-teacher-picker glass-panel"><div className="vtp-fields"><label>Ismingiz<input value={voteName} onChange={(e) => onVoteName(e.target.value)} placeholder="Masalan: Ali Valiyev" /></label><label>Qaysi o'qituvchi?<select value={voteTeacher} onChange={(e) => onVoteTeacher(e.target.value)}><option value="">O'qituvchini tanlang</option>{teachers.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.subject}</option>)}</select></label></div><small className="muted vtp-hint">Ismingizni yozing va ustozni tanlang, so'ng party'ga ovoz bering. Bir o'quvchi faqat bir marta ovoz beradi.</small></div>}
    {voted && votedParty && <div className="closed-banner glass-panel"><Check size={17} /><span><strong>Siz "{votedParty}" uchun ovoz berdingiz</strong><small>Bir o'quvchi faqat bir marta ovoz bera oladi.</small></span></div>}
    <section className={`party-grid ${(!partyVotingOpen || voted) ? 'voting-closed' : ''}`}>{parties.map((party, index) => <button disabled={!partyVotingOpen || voted || !voteTeacher || !voteName.trim()} className={`party-card ${party.tone} ${selectedParty === party.id ? 'chosen' : ''}`} key={party.id} onClick={() => vote(party.id)}><div className="party-top"><span className="party-number">0{index + 1}</span><span className="party-icon">{party.icon}</span>{selectedParty === party.id && <span className="chosen-mark"><Check size={14} /></span>}</div><div className="party-info"><h3>{party.title}</h3><p>{party.subtitle}</p></div><div className="party-foot"><span>{voted ? `${party.votes} ta ovoz` : 'Natija yopiq'}</span><span>{voted && selectedParty === party.id ? 'Siz ovoz berdingiz' : (!voteName.trim() ? 'Avval ismingizni yozing' : !voteTeacher ? 'Ustozni tanlang' : 'Ovoz berish')} <ArrowRight size={15} /></span></div><div className="party-line"><span style={{ width: voted ? `${party.votes}%` : '0%' }} /></div></button>)}</section>
    <button className="suggest-card glass-panel" onClick={onSuggest}><span className="suggest-icon"><Plus size={20} /></span><span><strong>O'zingiz taklif qiling</strong><small>Ro'yxatda yo'q boshqa g'oya bormi?</small></span><ArrowRight size={18} /></button>
    <section className="below-grid"><div className="section-block rating-block"><div className="section-head compact"><div><p className="eyebrow">TOP O'QITUVCHILAR</p><h2>Ustozlar reytingi</h2></div><Trophy size={20} className="gold" /></div><p className="muted">Eng yuqori reyting avtomatik birinchi o'ringa chiqadi.</p><div className="top-teachers">{rankedTeachers.map((teacher, index) => { const score = teacherRatings[teacher.name] || teacher.rating || 0; const medal = ['🥇', '🥈', '🥉'][index] || `0${index + 1}`; return <div className={`teacher-row top-${index + 1}`} key={teacher.name}><span className="rank-medal">{medal}</span><button className="profile-open" onClick={() => onProfile(teacher)} aria-label={`${teacher.name} profili`}><div className="teacher-avatar">{teacher.image ? <img src={teacher.image} alt="" /> : teacher.initials}</div><div><strong>{teacher.name}</strong><small>{teacher.subject} · {score.toFixed(1)} ★</small></div></button><button disabled={teacherRated} className="star-button" onClick={() => onRate(teacher.name)}><Star size={17} fill={teacherRatings[teacher.name] ? 'currentColor' : 'none'} /></button></div> })}</div></div></section>
  </div>
}

function TeacherDialog({ initialTeacher, onClose, onSubmit }: { initialTeacher?: Teacher; onClose: () => void; onSubmit: (teacher: NewTeacher) => Promise<string | null> }) {
  const [name, setName] = useState(initialTeacher?.name || '')
    const [subject, setSubject] = useState(initialTeacher?.subject || '')
    const [image, setImage] = useState(initialTeacher?.image || '')
    const [login, setLogin] = useState(initialTeacher?.login || '')
    const [password, setPassword] = useState(initialTeacher?.password || '')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const chooseImage = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => setImage(typeof reader.result === 'string' ? reader.result : '')
      reader.readAsDataURL(file)
    }
    const complete = name.trim() && subject.trim() && login.trim() && password.trim()
    const submit = async () => {
      setSaving(true)
      setError('')
      const message = await onSubmit({ name: name.trim(), subject: subject.trim(), color: 'purple', image, login: login.trim(), password: password.trim() })
      setSaving(false)
      if (message) setError(message)
    }
    return <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass-panel teacher-modal" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose}><X size={18} /></button>
        <div className="modal-icon"><Users size={22} /></div>
        <p className="eyebrow">{initialTeacher ? "O'QITUVCHINI TAHRIRLASH" : "O'QITUVCHI QO'SHISH"}</p>
        <h2>{initialTeacher ? "Ustoz ma'lumotlarini yangilang." : "Yangi domla qo'shing."}</h2>
        <p className="muted">Ism, yo'nalish, rasm va kirish uchun login/parol kiriting.</p>
        <div className="teacher-photo-picker">
          {image ? <img src={image} alt="O'qituvchi preview" /> : <Users size={25} />}
          <label htmlFor="teacher-image">Rasm tanlash<input id="teacher-image" type="file" accept="image/*" onChange={chooseImage} /></label>
        </div>
        <label>Ism va familiya<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Masalan: Nodira Aliyeva" /></label>
        <label>Yo'nalish<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Masalan: General English" /></label>
        <label>Login (ustoz panelga kirish uchun)<input value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Masalan: nodira" /></label>
        <label>Parol<input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masalan: nodira2026" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary full" disabled={!complete || saving} onClick={submit}><Check size={16} /> {saving ? 'Saqlanmoqda...' : initialTeacher ? 'Saqlash' : "O'qituvchini qo'shish"}</button>
      </div>
   </div>
  }

function SuggestionDialog({ teachers, teacher, text, onTeacher, onText, onClose, onSubmit }: { teachers: Teacher[]; teacher: string; text: string; onTeacher: (value: string) => void; onText: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
  const complete = teacher.trim() && text.trim()
  return <div className="modal-backdrop" onClick={onClose}><div className="modal glass-panel suggestion-modal" onClick={(e) => e.stopPropagation()}><button className="close" onClick={onClose}><X size={18} /></button><div className="modal-icon"><Lightbulb size={22} /></div><p className="eyebrow">YANGI TAKLIF</p><h2>Keyingi safar nima qilamiz?</h2><p className="muted">O'qituvchingizni tanlab, taklifingizni yozing.</p><label>Qaysi o'qituvchi?<select value={teacher} onChange={(e) => onTeacher(e.target.value)}><option value="">O'qituvchini tanlang</option>{teachers.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.subject}</option>)}</select></label><textarea value={text} onChange={(e) => onText(e.target.value)} placeholder="Masalan: Burger party..." /><button className="primary full" disabled={!complete} onClick={onSubmit}><Send size={16} /> Taklifni yuborish</button></div></div>
}

function TeacherProfile({ teacher, suggestions, votes, onClose }: { teacher: Teacher; suggestions: Suggestion[]; votes: number; onClose: () => void }) {
  const studentCount = votes
  const teacherSuggestions = suggestions.filter((item) => item.teacher === teacher.name)
  return <div className="modal-backdrop" onClick={onClose}><div className="modal glass-panel teacher-profile" onClick={(e) => e.stopPropagation()}><button className="close" onClick={onClose}><X size={18} /></button><div className="profile-top"><div className="teacher-avatar profile-avatar">{teacher.image ? <img src={teacher.image} alt="" /> : teacher.initials}</div><div><p className="eyebrow">O'QITUVCHI PROFILI</p><h2>{teacher.name}</h2><small className="muted">{teacher.subject}</small></div></div><div className="profile-stats"><div><strong>{studentCount}</strong><small>Ovoz bergan o'quvchilar</small></div><div><strong>{teacherSuggestions.length}</strong><small>Taklif berganlar</small></div><div><strong>{(votes ? (teacher.rating || 0).toFixed(1) : '0.0')} ★</strong><small>Reyting</small></div></div>{teacherSuggestions.length > 0 && <><p className="eyebrow">O'QUVCHILAR TAKLIFLARI</p><div className="profile-suggestions">{teacherSuggestions.map((item) => <div className="profile-suggestion" key={item.text}><Lightbulb size={15} /><div><strong>{item.text}</strong><small>{item.author}</small></div></div>)}</div></>}</div></div>
}

function RatingDialog({ teacher, onClose, onSubmit }: { teacher: string; onClose: () => void; onSubmit: (value: number) => void }) {
  const [value, setValue] = useState(0)
  return <div className="modal-backdrop" onClick={onClose}><div className="modal glass-panel rating-dialog" onClick={(e) => e.stopPropagation()}><button className="close" onClick={onClose}><X size={18} /></button><div className="modal-icon"><Star size={22} /></div><p className="eyebrow">USTOZ REYTINGI</p><h2>{teacher}</h2><p className="muted">Darslar va yordam uchun baho bering.</p><div className="rating-stars">{[1, 2, 3, 4, 5].map((star) => <button key={star} onClick={() => setValue(star)} aria-label={`${star} yulduz`}><Star size={30} fill={star <= value ? 'currentColor' : 'none'} /></button>)}</div><button className="primary full" disabled={!value} onClick={() => onSubmit(value)}><Check size={16} /> Bahoni yuborish</button></div></div>
}

function AdminLogin({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = () => login.trim().toLowerCase() === 'timeschool' && password === '112231' ? onLogin() : setError('Login yoki parol noto\'g\'ri.')
  return <div className="modal-backdrop" onClick={onClose}><div className="modal glass-panel login-modal" onClick={(e) => e.stopPropagation()}><button className="close" onClick={onClose}><X size={18} /></button><div className="modal-icon"><Settings2 size={22} /></div><p className="eyebrow">ADMIN KIRISH</p><h2>Panelga xush kelibsiz.</h2><p className="muted">Markaz boshqaruvi uchun login va parolingizni kiriting.</p><label>Login<input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Admin login" /></label><label>Parol<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin paroli" onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>{error && <p className="form-error">{error}</p>}<button className="primary full" onClick={submit}><Settings2 size={16} /> Admin panelga kirish</button></div></div>
}

function TeacherLogin({ onClose, onLogin }: { onClose: () => void; onLogin: (name: string) => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = async () => {
    try {
      const res = await api.teacherLogin(login, password)
      onLogin(res.teacher.name)
    } catch {
      setError('Login yoki parol noto\'g\'ri.')
    }
  }
  return <div className="modal-backdrop" onClick={onClose}><div className="modal glass-panel login-modal" onClick={(e) => e.stopPropagation()}><button className="close" onClick={onClose}><X size={18} /></button><div className="modal-icon"><Users size={22} /></div><p className="eyebrow">O'QITUVCHI KIRISH</p><h2>Ustoz paneliga xush kelibsiz.</h2><p className="muted">Admin bergan login va parolingizni kiriting.</p><label>Login<input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Ustoz login" /></label><label>Parol<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ustoz paroli" onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>{error && <p className="form-error">{error}</p>}<button className="primary full" onClick={submit}><Users size={16} /> Ustoz panelga kirish</button></div></div>
}

function TeacherDiagram({ teachers, teacherRatings, onEdit, onRate }: { teachers: Teacher[]; teacherRatings: Record<string, number>; onEdit: (teacher: Teacher) => void; onRate: (name: string, value: number) => void }) {
  const rankedTeachers = [...teachers].sort((first, second) => (teacherRatings[second.name] || second.rating || 0) - (teacherRatings[first.name] || first.rating || 0))
  return <section className="teacher-diagram dashboard-card glass-panel"><div className="section-head compact"><div><p className="eyebrow">TOP O'QITUVCHILAR</p><h2>Reytingni boshqarish</h2></div><Trophy size={20} className="gold" /></div><p className="muted">Ustoz reytingini yulduzlarga bosib o'zgartiring.</p><div className="diagram-bars">{rankedTeachers.map((teacher) => { const score = teacherRatings[teacher.name] || teacher.rating || 0; return <div className="diagram-item" key={teacher.name}><div className="diagram-label"><span>{teacher.image ? <img src={teacher.image} alt="" /> : <i>{teacher.initials}</i>}<strong>{teacher.name}</strong></span><div className="admin-rate-stars">{[1, 2, 3, 4, 5].map((star) => <button key={star} className="admin-star" onClick={() => onRate(teacher.name, star)} aria-label={`${teacher.name} ${star} yulduz`}><Star size={15} fill={star <= Math.round(score) ? 'currentColor' : 'none'} /></button>)}<b>{score ? score.toFixed(1) : '—'}</b></div><button className="edit-teacher" onClick={() => onEdit(teacher)} aria-label={`${teacher.name} tahrirlash`}>Tahrirlash</button></div><div className="bar-track"><span style={{ width: `${score ? score * 20 : 2}%` }} /></div></div> })}</div></section>
}

function AdminView({ parties, suggestions, teachers, teacherRatings, deadline, visitorCount, visitorHistory, dailyVotes, voteLog, votingOpen, onToggleVoting, onResetVotes, onSetParty, onAddTeacher }: { parties: Party[]; suggestions: Suggestion[]; teachers: Teacher[]; teacherRatings: Record<string, number>; deadline: number; visitorCount: number; visitorHistory: VisitorDay[]; dailyVotes: number; voteLog: VoteLogEntry[]; votingOpen: boolean; onToggleVoting: () => void; onResetVotes: () => void; onSetParty: (text: string) => void; onAddTeacher: (teacher: NewTeacher) => void }) {
  const [newParty, setNewParty] = useState('')
  const [showTeacherForm, setShowTeacherForm] = useState(false)
  const [teacherName, setTeacherName] = useState('')
  const [teacherSubject, setTeacherSubject] = useState('')
  const [tab, setTab] = useState<'votes' | 'suggestions'>('votes')
  const [suggestionTeacherFilter, setSuggestionTeacherFilter] = useState('all')
  const [showNotifications, setShowNotifications] = useState(false)
  // Tashriflar statistikasi ko'rinishi: kunlik yoki oylik.
  const [visitorView, setVisitorView] = useState<'daily' | 'monthly'>('daily')
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Yangi taklif keldi', text: 'Burger party — Aziza Karimova', time: '5 daqiqa oldin' },
    { id: 2, title: 'Yangi ovoz', text: "Pizza Party ko'proq ovoz oldi", time: '18 daqiqa oldin' },
    { id: 3, title: "Ustoz baholandi", text: 'Jasur Akmalov — 5 yulduz', time: '1 soat oldin' },
  ])
  const total = parties.reduce((sum, party) => sum + party.votes, 0)
  const rankedTeachers = [...teachers].sort((first, second) => (teacherRatings[second.name] || second.rating || 0) - (teacherRatings[first.name] || first.rating || 0))
  const filteredSuggestions = suggestionTeacherFilter === 'all' ? suggestions : suggestions.filter((suggestion) => suggestion.teacher === suggestionTeacherFilter)
  // Tashriflar jadvali: kunlik — har bir sana alohida; oylik — bir oy yig'indisi.
  const visitorRows = visitorView === 'daily'
    ? [...visitorHistory].reverse()
    : Object.values(visitorHistory.reduce<Record<string, { key: string; date: string; count: number }>>((acc, day) => {
        const month = day.date.slice(0, 7) // YYYY-MM
        if (!acc[month]) acc[month] = { key: month, date: month + '-01', count: 0 }
        acc[month].count += day.count
        return acc
      }, {})).sort((a, b) => (a.key < b.key ? 1 : -1))
  return <div className="content admin-content"><div className="admin-heading"><div><p className="eyebrow"><span className="live-dot" /> ADMIN PANEL · BUGUN, 09:41</p><h1>Markaz kayfiyati<br /><em>sizning qo'lingizda.</em></h1></div><div className="admin-actions"><div className="notif-wrap"><button className="secondary" onClick={() => setShowNotifications((value) => !value)}><Bell size={16} /> Bildirishnomalar {notifications.length > 0 && <b>{notifications.length}</b>}</button>{showNotifications && <div className="notif-panel glass-panel"><div className="notif-head"><strong>Bildirishnomalar</strong>{notifications.length > 0 && <button onClick={() => setNotifications([])}>Tozalash</button>}</div>{notifications.length === 0 ? <p className="muted notif-empty">Hozircha bildirishnoma yo'q.</p> : notifications.map((item) => <div className="notif-item" key={item.id}><span className="notif-dot" /><div><strong>{item.title}</strong><small>{item.text}</small></div><small className="notif-time">{item.time}</small></div>)}</div>}</div><button className="primary"><Users size={17} /> Ustoz qo'shish</button></div></div><section className="stats-grid"><div className="stat-card glass-panel"><div className="stat-icon mint"><Users size={18} /></div><small>Bugun kirganlar</small><strong>{visitorCount}</strong><span className="trend"><small>saytga kirganlar</small></span></div><div className="stat-card glass-panel"><div className="stat-icon coral"><Vote size={18} /></div><small>Bugungi ovozlar</small><strong>{dailyVotes}</strong><span className="trend"><small>kunlik ovoz</small></span></div><div className="stat-card glass-panel"><div className="stat-icon blue"><MessageCircle size={18} /></div><small>Yangi takliflar</small><strong>{suggestions.length}</strong><span className="trend"><small>jami</small></span></div></section><section className="dashboard-card glass-panel"><div className="section-head compact"><div><p className="eyebrow">{visitorView === 'daily' ? 'KUNLIK TASHRIFLAR' : 'OYLIK TASHRIFLAR'}</p><h2>{visitorView === 'daily' ? 'Qaysi kuni qancha odam kirdi' : 'Qaysi oyda qancha odam kirdi'}</h2></div><div className="tab-switch"><button className={visitorView === 'daily' ? 'active' : ''} onClick={() => setVisitorView('daily')}>Kunlik</button><button className={visitorView === 'monthly' ? 'active' : ''} onClick={() => setVisitorView('monthly')}>Oylik</button></div></div>{visitorRows.length === 0 ? <p className="muted notif-empty">Hozircha ma'lumot yo'q.</p> : <div className="people-table"><div className="table-row table-head"><span>{visitorView === 'daily' ? 'Sana' : 'Oy'}</span><span>Odamlar soni</span><span>Holat</span></div>{visitorRows.map((row) => <div className="table-row" key={row.date}><span><strong>{visitorView === 'daily' ? new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(row.date)) : new Intl.DateTimeFormat('uz-UZ', { month: 'long', year: 'numeric' }).format(new Date(row.date))}</strong></span><span><Users size={14} /> {row.count} ta odam</span><small className="muted">{visitorView === 'daily' && row.date === new Date().toISOString().slice(0, 10) ? 'Bugun' : ''}</small></div>)}</div>}</section><section className={`dashboard-card glass-panel voting-control ${votingOpen ? '' : 'is-closed'}`}><div><p className="eyebrow">OVOZ BERISH BOSHQARUVI</p><h2>{votingOpen ? 'Ovoz berish ochiq' : 'Ovoz berish to\'xtatilgan'}</h2><p className="muted">{votingOpen ? 'Konkurs tugagach, ovoz berishni to\'xtatishingiz mumkin.' : 'Yangi party qo\'shib, ovoz berishni qayta boshlashingiz mumkin.'}</p></div><div className="voting-buttons"><button className={votingOpen ? 'danger' : 'primary'} onClick={onToggleVoting}>{votingOpen ? 'Ovoz berishni to\'xtatish' : 'Ovoz berishni boshlash'}</button><button className="secondary" onClick={onResetVotes}>Ovozlarni ochirish va yangilash</button></div></section><section className="dashboard-grid"><div className="dashboard-card glass-panel"><div className="section-head compact"><div><p className="eyebrow">OVOZLAR NATIJASI</p><h2>Keyingi party tanlovi</h2></div><button className="filter-button">{new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'long' }).format(deadline)} <ChevronDown size={14} /></button></div><div className="donut-wrap"><div className="donut"><div><strong>{total}</strong><small>JAMI OVOZ</small></div></div><div className="legend">{parties.map((party) => <div key={party.id}><span className={`legend-dot ${party.tone}`} /><span>{party.icon} {party.title}</span><strong>{Math.round(party.votes / total * 100)}%</strong></div>)}</div></div></div><div className="dashboard-card glass-panel live-ranking"><div className="section-head compact"><div><p className="eyebrow">REAL-TIME</p><h2>O'qituvchilar reytingi</h2></div><span className="pill-live"><span className="live-dot" /> LIVE</span></div>{teachers.map((teacher, index) => <div className="rank-row" key={teacher.name}><b className="rank">0{index + 1}</b><div className={`teacher-avatar ${teacher.color}`}>{teacher.image ? <img src={teacher.image} alt="" /> : teacher.initials}</div><div className="rank-name"><strong>{teacher.name}</strong><small>{teacher.subject}</small></div><div className="stars"><Star size={13} fill="currentColor" /> <strong>{teacherRatings[teacher.name] || teacher.rating}</strong></div><span className="rank-change">↗</span></div>)}</div></section><section className="dashboard-card glass-panel submissions"><div className="section-head compact"><div><p className="eyebrow">FEEDBACK HUB</p><h2>O'quvchilar fikri</h2></div><div className="tab-switch"><button className={tab === 'votes' ? 'active' : ''} onClick={() => setTab('votes')}><ListChecks size={15} /> Ovoz berganlar</button><button className={tab === 'suggestions' ? 'active' : ''} onClick={() => setTab('suggestions')}><Lightbulb size={15} /> Taklif berganlar</button></div></div>{tab === 'suggestions' && <div className="suggestion-filter"><select value={suggestionTeacherFilter} onChange={(event) => setSuggestionTeacherFilter(event.target.value)}><option value="all">Barcha ustozlar</option>{teachers.map((teacher) => <option key={teacher.name} value={teacher.name}>{teacher.name}</option>)}</select></div>}{tab === 'votes' ? <div className="people-table"><div className="table-row table-head"><span>O'quvchi</span><span>Tanlovi</span><span>Ustoz</span><span>Vaqt</span></div>{voteLog.length === 0 ? <p className="muted notif-empty">Hozircha hech kim ovoz bermagan.</p> : voteLog.map((entry) => <div className="table-row" key={entry.time}><span><div className="small-avatar">{entry.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</div><strong>{entry.name}</strong></span><span>{parties.find((p) => p.title === entry.party)?.icon} {entry.party}</span><span>{entry.teacher || '—'}</span><span className="muted">{new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(entry.time)}</span></div>)}</div> : <div className="people-table"><div className="table-row table-head"><span>O'quvchi</span><span>Taklif</span><span>Ustoz</span></div>{filteredSuggestions.length === 0 ? <p className="muted notif-empty">Hozircha taklif yo'q.</p> : filteredSuggestions.map((item) => <div className="table-row suggestion-table" key={item.text}><span><div className="small-avatar">{item.author.split(' ').map((x) => x[0]).join('').slice(0, 2)}</div><strong>{item.author}</strong></span><span><Lightbulb size={14} /> {item.text}</span><small className="muted">{item.teacher}</small></div>)}</div>}</section><section className="dashboard-card glass-panel create-party"><div><p className="eyebrow">KEYINGI HAFTA</p><h2>Yangi party qo'shish</h2><p className="muted">Tasdiqlangan taklifni keyingi ovoz berishga qo'shing.</p></div><div className="create-form"><input value={newParty} onChange={(e) => setNewParty(e.target.value)} placeholder="Party nomi..." /><button className="primary" onClick={() => { if (newParty.trim()) { onSetParty(newParty.trim()); setNewParty('') } }}><Plus size={16} /> Qo'shish</button></div></section></div>
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<App />)