import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight, Bell, CalendarDays, Check, ChevronDown, Clock3, Flame,
  Lightbulb, ListChecks, MessageCircle, Plus, Send, Settings2, Sparkles,
  Star, Trophy, Users, Vote, X, Zap, LogOut,
} from 'lucide-react'
import './styles.css'

type Party = { id: number; title: string; subtitle: string; icon: string; tone: string; votes: number }
type Suggestion = { text: string; author: string; group: string; teacher: string; votes: number; status: string }
type Teacher = { name: string; subject: string; initials: string; color: string; rating: number; votes: number; image?: string }
type NewTeacher = { name: string; subject: string; color: string; image?: string }

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

const initialParties: Party[] = [
  { id: 1, title: 'Pizza Party', subtitle: 'Issiq, pishloqli va hammaga tanish', icon: '🍕', tone: 'coral', votes: 78 },
  { id: 2, title: 'Fruit Party', subtitle: 'Yangi mevalar va vitaminli kayfiyat', icon: '🍓', tone: 'mint', votes: 52 },
  { id: 3, title: 'Movie Night', subtitle: 'Film, popcorn va yaxshi suhbat', icon: '▶', tone: 'blue', votes: 31 },
]

const initialSuggestions: Suggestion[] = [
  { text: 'Burger party', author: 'Aziza Karimova', group: 'IELTS · 17:00', teacher: 'Jasur Akmalov', votes: 17, status: 'Yangi' },
  { text: 'Karaoke kechasi', author: 'Bekzod Ismoilov', group: 'General English · 15:30', teacher: 'Malika Raximova', votes: 11, status: 'Yangi' },
  { text: 'Sushi workshop', author: 'Madina Tojiboyeva', group: 'IELTS · 17:00', teacher: 'Jasur Akmalov', votes: 8, status: 'Yangi' },
]

const initialTeachers: Teacher[] = [
  { name: 'Jasur Akmalov', subject: 'IELTS Instructor', initials: 'JA', color: 'blue', rating: 4.9, votes: 42 },
  { name: 'Malika Raximova', subject: 'General English', initials: 'MR', color: 'orange', rating: 4.8, votes: 38 },
  { name: 'Sardor Sobirov', subject: 'Speaking Club', initials: 'SS', color: 'green', rating: 4.7, votes: 29 },
]

function App() {
  const adminRoute = window.location.pathname === '/admin'
  const [mode, setMode] = useState<'student' | 'admin'>(adminRoute ? 'admin' : 'student')
  const [isAdminAuthed, setIsAdminAuthed] = useSavedState('time-school-admin-auth', false)
  const [showLogin, setShowLogin] = useState(adminRoute && !isAdminAuthed)
  const [showTeacherForm, setShowTeacherForm] = useState(false)
  const [parties, setParties] = useSavedState('time-school-parties', initialParties)
  const [teachers, setTeachers] = useSavedState('time-school-teachers', initialTeachers)
  const [suggestions, setSuggestions] = useSavedState('time-school-suggestions', initialSuggestions)
  const [selectedParty, setSelectedParty] = useSavedState<number | null>('time-school-selected-party', null)
  const [voted, setVoted] = useSavedState('time-school-voted', false)
  const [partyVotingOpen, setPartyVotingOpen] = useSavedState('time-school-voting-open', true)
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [suggestionText, setSuggestionText] = useState('')
  const [suggestionFirstName, setSuggestionFirstName] = useState('')
  const [suggestionLastName, setSuggestionLastName] = useState('')
  const [suggestionGroup, setSuggestionGroup] = useState('')
  const [suggestionTeacher, setSuggestionTeacher] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [rating, setRating] = useState(0)
  const [teacherRatings, setTeacherRatings] = useSavedState<Record<string, number>>('time-school-teacher-ratings', {})
  const [teacherRated, setTeacherRated] = useSavedState('time-school-teacher-rated', false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [adminSuggestionTeacher, setAdminSuggestionTeacher] = useState('all')
  const [deadline] = useSavedState('time-school-deadline', Date.now() + (10 * 24 * 60 * 60 + 26 * 60 * 60 + 5 * 60) * 1000)
  const [now, setNow] = useState(Date.now())

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

  const seconds = Math.max(0, Math.floor((deadline - now) / 1000))
  const currentTime = new Intl.DateTimeFormat('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now)

  const countdown = useMemo(() => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return [days, hours, minutes, secs]
  }, [seconds])

  const vote = (id: number) => {
    if (voted || !partyVotingOpen) return
    setSelectedParty(id)
    setParties((items) => items.map((item) => item.id === id ? { ...item, votes: item.votes + 1 } : item))
    setVoted(true)
    setPartyVotingOpen(false)
    setShowSuccess(true)
  }

  const submitSuggestion = () => {
    if (!suggestionText.trim() || !suggestionFirstName.trim() || !suggestionLastName.trim() || !suggestionGroup.trim() || !suggestionTeacher.trim()) return
    setSuggestions((items) => [{ text: suggestionText.trim(), author: `${suggestionFirstName.trim()} ${suggestionLastName.trim()}`, group: suggestionGroup.trim(), teacher: suggestionTeacher, votes: 0, status: 'Yangi' }, ...items])
    setSuggestionText('')
    setSuggestionFirstName('')
    setSuggestionLastName('')
    setSuggestionGroup('')
    setSuggestionTeacher('')
    setShowSuggestion(false)
    setShowSuccess(true)
  }

  const submitRating = (submittedRating = rating) => {
    if (!selectedTeacher || !submittedRating || teacherRated) return
    setTeacherRatings((items) => ({ ...items, [selectedTeacher]: submittedRating }))
    setSelectedTeacher('')
    setRating(0)
    setTeacherRated(true)
    setShowSuccess(true)
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <nav className="topbar glass-panel">
        <div className="brand"><div className="school-logo"><span className="logo-t">T</span><span className="logo-s">S</span></div><span>TIME <b>SCHOOL</b> <span>PARTY</span></span></div>
        <div className="topbar-right" />
      </nav>

      {mode === 'student' ? (
        <StudentView countdown={countdown} currentTime={currentTime} parties={parties} teachers={teachers} selectedParty={selectedParty} voted={voted} partyVotingOpen={partyVotingOpen} vote={vote} onSuggest={() => setShowSuggestion(true)} onRate={(name) => setSelectedTeacher(name)} teacherRatings={teacherRatings} teacherRated={teacherRated} />
      ) : (
        <><TeacherFilter teachers={teachers} value={adminSuggestionTeacher} onChange={setAdminSuggestionTeacher} /><AdminView parties={parties} suggestions={adminSuggestionTeacher === 'all' ? suggestions : suggestions.filter((item) => item.teacher === adminSuggestionTeacher)} teachers={teachers} teacherRatings={teacherRatings} onSetParty={(text) => setParties((items) => [{ id: Date.now(), title: text, subtitle: 'Admin tomonidan qo\'shilgan party', icon: '✨', tone: 'mint', votes: 0 }, ...items])} onAddTeacher={(teacher) => setTeachers((items) => [...items, { ...teacher, initials: teacher.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), votes: 0, rating: 0 }])} /><TeacherDiagram teachers={teachers} teacherRatings={teacherRatings} onEdit={setEditingTeacher} /><button className="logout-button" onClick={() => { setIsAdminAuthed(false); setMode('student'); window.history.pushState({}, '', '/') }}><LogOut size={15} /> Admin paneldan chiqish</button></>
      )}

      {showLogin && <AdminLogin onClose={() => { setShowLogin(false); setMode('student'); window.history.pushState({}, '', '/') }} onLogin={() => { setIsAdminAuthed(true); setMode('admin'); setShowLogin(false) }} />}
      {showTeacherForm && <TeacherDialog onClose={() => setShowTeacherForm(false)} onSubmit={(teacher) => { setTeachers((items) => [...items, { ...teacher, initials: teacher.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), votes: 0, rating: 0 }]); setShowTeacherForm(false); setShowSuccess(true) }} />}
      {editingTeacher && <TeacherDialog initialTeacher={editingTeacher} onClose={() => setEditingTeacher(null)} onSubmit={(teacher) => { setTeachers((items) => items.map((item) => item.name === editingTeacher.name ? { ...item, ...teacher, initials: teacher.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() } : item)); setEditingTeacher(null); setShowSuccess(true) }} />}
      {showSuggestion && <SuggestionDialog teachers={teachers} firstName={suggestionFirstName} lastName={suggestionLastName} group={suggestionGroup} teacher={suggestionTeacher} text={suggestionText} onFirstName={setSuggestionFirstName} onLastName={setSuggestionLastName} onGroup={setSuggestionGroup} onTeacher={setSuggestionTeacher} onText={setSuggestionText} onClose={() => setShowSuggestion(false)} onSubmit={submitSuggestion} />}
      {selectedTeacher && <RatingDialog teacher={selectedTeacher} onClose={() => setSelectedTeacher('')} onSubmit={(value) => { setRating(value); submitRating(value) }} />}
      {showSuccess && <div className="toast glass-panel"><div className="toast-check"><Check size={15} /></div><div><strong>Rahmat, qabul qilindi!</strong><small>Admin taklifingizni ko'rib chiqadi.</small></div><button onClick={() => setShowSuccess(false)}><X size={15} /></button></div>}
    </main>
  )
}

function StudentView({ countdown, currentTime, parties, teachers, selectedParty, voted, partyVotingOpen, vote, onSuggest, onRate, teacherRatings, teacherRated }: { countdown: number[]; currentTime: string; parties: Party[]; teachers: Teacher[]; selectedParty: number | null; voted: boolean; partyVotingOpen: boolean; vote: (id: number) => void; onSuggest: () => void; onRate: (name: string) => void; teacherRatings: Record<string, number>; teacherRated: boolean }) {
  const rankedTeachers = [...teachers].sort((first, second) => (teacherRatings[second.name] || second.rating || 0) - (teacherRatings[first.name] || first.rating || 0))
  return <div className="content student-content"><div className="live-time-label">Hozirgi vaqt: <strong>{currentTime}</strong></div>
    <section className="hero-row"><div><p className="eyebrow"><span className="live-dot" /> TIME PARTY · MAYDON</p><h1>Keyingi party'ni<br /><em>birgalikda tanlaymiz.</em></h1><p className="hero-copy">Sizning ovozingiz markazimizdagi keyingi unutilmas kunni yaratadi.</p></div><div className="next-event glass-panel"><div className="event-head"><span><CalendarDays size={15} /> Ovoz berish yopilishigacha</span><span className="pill-live">LIVE</span></div><div className="countdown">{countdown.map((value, i) => <div className="time-cell" key={i}><strong>{String(value).padStart(2, '0')}</strong><small>{['KUN', 'SOAT', 'MIN', 'SEK'][i]}</small></div>)}</div><div className="progress"><span /></div><small className="muted">12-iyun, 2026 · 17:00 da yakunlanadi</small></div></section>
    <section className="section-head"><div><p className="eyebrow">OVOZ BERISH</p><h2>Qaysi biri bo'lsin?</h2></div><span className="vote-count"><Users size={15} /> {parties.reduce((a, b) => a + b.votes, 0)} ta ovoz</span></section>
    {!partyVotingOpen && <div className="closed-banner glass-panel"><Check size={17} /><span><strong>Ovoz berish yopildi</strong><small>Sizning tanlovingiz qabul qilindi. Keyingi ovoz berish yangi party bilan ochiladi.</small></span></div>}
    <section className={`party-grid ${!partyVotingOpen ? 'voting-closed' : ''}`}>{parties.map((party, index) => <button disabled={!partyVotingOpen} className={`party-card ${party.tone} ${selectedParty === party.id ? 'chosen' : ''}`} key={party.id} onClick={() => vote(party.id)}><div className="party-top"><span className="party-number">0{index + 1}</span><span className="party-icon">{party.icon}</span>{selectedParty === party.id && <span className="chosen-mark"><Check size={14} /></span>}</div><div className="party-info"><h3>{party.title}</h3><p>{party.subtitle}</p></div><div className="party-foot"><span>{party.votes}% tanlandi</span><span>{voted && selectedParty === party.id ? 'Siz ovoz berdingiz' : 'Ovoz berish'} <ArrowRight size={15} /></span></div><div className="party-line"><span style={{ width: `${party.votes}%` }} /></div></button>)}</section>
    <button className="suggest-card glass-panel" onClick={onSuggest}><span className="suggest-icon"><Plus size={20} /></span><span><strong>O'zingiz taklif qiling</strong><small>Ro'yxatda yo'q boshqa g'oya bormi?</small></span><ArrowRight size={18} /></button>
    <section className="below-grid"><div className="section-block"><div className="section-head compact"><div><p className="eyebrow">KEYINGI SAFAR</p><h2>Takliflar qutisi</h2></div><button className="text-button" onClick={onSuggest}>+ Taklif berish</button></div><div className="suggestion-list"><div className="suggestion-item"><span className="mini-icon orange"><Flame size={16} /></span><div><strong>Street food festival</strong><small>Kamola · 14 ta ovoz</small></div><span className="tag">Top taklif</span></div><div className="suggestion-item"><span className="mini-icon blue"><Sparkles size={16} /></span><div><strong>Board games kechasi</strong><small>Aziz · 9 ta ovoz</small></div><span className="tag neutral">Yangi</span></div></div></div><div className="section-block rating-block"><div className="section-head compact"><div><p className="eyebrow">JONLI REYTING</p><h2>Ustozlar reytingi</h2></div><Trophy size={20} className="gold" /></div><p className="muted">Eng yuqori reyting avtomatik birinchi o'ringa chiqadi.</p>{rankedTeachers.map((teacher) => <div className="teacher-row" key={teacher.name}><div className="teacher-avatar">{teacher.image ? <img src={teacher.image} alt="" /> : teacher.initials}</div><div><strong>{teacher.name}</strong><small>{teacher.subject} · {(teacherRatings[teacher.name] || teacher.rating).toFixed(1)} ★</small></div><button disabled={teacherRated} className="star-button" onClick={() => onRate(teacher.name)}><Star size={17} fill={teacherRatings[teacher.name] ? 'currentColor' : 'none'} /></button></div>)}</div></section>
  </div>
}

function TeacherDialog({ initialTeacher, onClose, onSubmit }: { initialTeacher?: Teacher; onClose: () => void; onSubmit: (teacher: NewTeacher) => void }) {
  const [name, setName] = useState(initialTeacher?.name || '')
  const [subject, setSubject] = useState(initialTeacher?.subject || '')
  const [image, setImage] = useState(initialTeacher?.image || '')
  const chooseImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
  }
  const complete = name.trim() && subject.trim()
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal glass-panel teacher-modal" onClick={(event) => event.stopPropagation()}>
      <button className="close" onClick={onClose}><X size={18} /></button>
      <div className="modal-icon"><Users size={22} /></div>
      <p className="eyebrow">{initialTeacher ? "O'QITUVCHINI TAHRIRLASH" : "O'QITUVCHI QO'SHISH"}</p>
      <h2>{initialTeacher ? "Ustoz ma'lumotlarini yangilang." : "Yangi domla qo'shing."}</h2>
      <p className="muted">Ism, yo'nalish va ustozning rasmini kiriting.</p>
      <div className="teacher-photo-picker">
        {image ? <img src={image} alt="O'qituvchi preview" /> : <Users size={25} />}
        <label htmlFor="teacher-image">Rasm tanlash<input id="teacher-image" type="file" accept="image/*" onChange={chooseImage} /></label>
      </div>
      <label>Ism va familiya<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Masalan: Nodira Aliyeva" /></label>
      <label>Yo'nalish<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Masalan: General English" /></label>
      <button className="primary full" disabled={!complete} onClick={() => onSubmit({ name: name.trim(), subject: subject.trim(), color: 'purple', image })}><Check size={16} /> {initialTeacher ? 'Saqlash' : "O'qituvchini qo'shish"}</button>
    </div>
  </div>
}

function SuggestionDialog({ teachers, firstName, lastName, group, teacher, text, onFirstName, onLastName, onGroup, onTeacher, onText, onClose, onSubmit }: { teachers: Teacher[]; firstName: string; lastName: string; group: string; teacher: string; text: string; onFirstName: (value: string) => void; onLastName: (value: string) => void; onGroup: (value: string) => void; onTeacher: (value: string) => void; onText: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
  const complete = firstName.trim() && lastName.trim() && group.trim() && teacher.trim() && text.trim()
  return <div className="modal-backdrop" onClick={onClose}><div className="modal glass-panel suggestion-modal" onClick={(e) => e.stopPropagation()}><button className="close" onClick={onClose}><X size={18} /></button><div className="modal-icon"><Lightbulb size={22} /></div><p className="eyebrow">YANGI TAKLIF</p><h2>Keyingi safar nima qilamiz?</h2><p className="muted">Guruhingiz va o'qituvchingizni tanlab, taklifingizni yozing.</p><div className="form-grid"><label>Ism<input value={firstName} onChange={(e) => onFirstName(e.target.value)} placeholder="Aziza" /></label><label>Familiya<input value={lastName} onChange={(e) => onLastName(e.target.value)} placeholder="Karimova" /></label></div><label>Qaysi guruhda o'qiysiz?<input value={group} onChange={(e) => onGroup(e.target.value)} placeholder="IELTS · 17:00" /></label><label>Kimning o'quvchisisiz?<select value={teacher} onChange={(e) => onTeacher(e.target.value)}><option value="">O'qituvchini tanlang</option>{teachers.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.subject}</option>)}</select></label><textarea value={text} onChange={(e) => onText(e.target.value)} placeholder="Masalan: Burger party..." /><button className="primary full" disabled={!complete} onClick={onSubmit}><Send size={16} /> Taklifni yuborish</button></div></div>
}

function RatingDialog({ teacher, onClose, onSubmit }: { teacher: string; onClose: () => void; onSubmit: (value: number) => void }) {
  const [value, setValue] = useState(0)
  return <div className="modal-backdrop" onClick={onClose}><div className="modal glass-panel rating-dialog" onClick={(e) => e.stopPropagation()}><button className="close" onClick={onClose}><X size={18} /></button><div className="modal-icon"><Star size={22} /></div><p className="eyebrow">USTOZ REYTINGI</p><h2>{teacher}</h2><p className="muted">Darslar va yordam uchun baho bering.</p><div className="rating-stars">{[1, 2, 3, 4, 5].map((star) => <button key={star} onClick={() => setValue(star)} aria-label={`${star} yulduz`}><Star size={30} fill={star <= value ? 'currentColor' : 'none'} /></button>)}</div><button className="primary full" disabled={!value} onClick={() => onSubmit(value)}><Check size={16} /> Bahoni yuborish</button></div></div>
}

function AdminLogin({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = () => login === 'admin' && password === '1234' ? onLogin() : setError('Login yoki parol noto\'g\'ri.')
  return <div className="modal-backdrop" onClick={onClose}><div className="modal glass-panel login-modal" onClick={(e) => e.stopPropagation()}><button className="close" onClick={onClose}><X size={18} /></button><div className="modal-icon"><Settings2 size={22} /></div><p className="eyebrow">ADMIN KIRISH</p><h2>Panelga xush kelibsiz.</h2><p className="muted">Markaz boshqaruvi uchun login va parolingizni kiriting.</p><label>Login<input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Admin login" /></label><label>Parol<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin paroli" onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>{error && <p className="form-error">{error}</p>}<button className="primary full" onClick={submit}><Settings2 size={16} /> Admin panelga kirish</button><small className="login-hint">Demo kirish: admin / 1234</small></div></div>
}

function TeacherDiagram({ teachers, teacherRatings, onEdit }: { teachers: Teacher[]; teacherRatings: Record<string, number>; onEdit: (teacher: Teacher) => void }) {
  const rankedTeachers = [...teachers].sort((first, second) => (teacherRatings[second.name] || second.rating || 0) - (teacherRatings[first.name] || first.rating || 0))
  return <section className="teacher-diagram dashboard-card glass-panel"><div className="section-head compact"><div><p className="eyebrow">O'QITUVCHILAR TAQQOSLASH</p><h2>Reyting diagrammasi</h2></div><Trophy size={20} className="gold" /></div><div className="diagram-bars">{rankedTeachers.map((teacher) => { const score = teacherRatings[teacher.name] || teacher.rating || 0; return <div className="diagram-item" key={teacher.name}><div className="diagram-label"><span>{teacher.image ? <img src={teacher.image} alt="" /> : <i>{teacher.initials}</i>}<strong>{teacher.name}</strong></span><b>{score ? score.toFixed(1) : '—'}</b><button className="edit-teacher" onClick={() => onEdit(teacher)} aria-label={`${teacher.name} tahrirlash`}>Tahrirlash</button></div><div className="bar-track"><span style={{ width: `${score ? score * 20 : 2}%` }} /></div></div> })}</div></section>
}

function TeacherFilter({ teachers, value, onChange }: { teachers: Teacher[]; value: string; onChange: (value: string) => void }) {
  return <div className="teacher-filter glass-panel"><div><p className="eyebrow">TAKLIFLARNI KO'RISH</p><strong>Qaysi ustoz o'quvchilari?</strong></div><select value={value} onChange={(event) => onChange(event.target.value)}><option value="all">Barcha ustozlar</option>{teachers.map((teacher) => <option key={teacher.name} value={teacher.name}>{teacher.name}</option>)}</select></div>
}

function AdminView({ parties, suggestions, teachers, teacherRatings, onSetParty, onAddTeacher }: { parties: Party[]; suggestions: Suggestion[]; teachers: Teacher[]; teacherRatings: Record<string, number>; onSetParty: (text: string) => void; onAddTeacher: (teacher: NewTeacher) => void }) {
  const [newParty, setNewParty] = useState('')
  const [showTeacherForm, setShowTeacherForm] = useState(false)
  const [teacherName, setTeacherName] = useState('')
  const [teacherSubject, setTeacherSubject] = useState('')
  const [tab, setTab] = useState<'votes' | 'suggestions'>('votes')
  const [suggestionTeacherFilter, setSuggestionTeacherFilter] = useState('all')
  const total = parties.reduce((sum, party) => sum + party.votes, 0)
  const rankedTeachers = [...teachers].sort((first, second) => (teacherRatings[second.name] || second.rating || 0) - (teacherRatings[first.name] || first.rating || 0))
  const filteredSuggestions = suggestionTeacherFilter === 'all' ? suggestions : suggestions.filter((suggestion) => suggestion.teacher === suggestionTeacherFilter)
  return <div className="content admin-content"><div className="admin-heading"><div><p className="eyebrow"><span className="live-dot" /> ADMIN PANEL · BUGUN, 09:41</p><h1>Markaz kayfiyati<br /><em>sizning qo'lingizda.</em></h1></div><div className="admin-actions"><button className="secondary"><Bell size={16} /> Bildirishnomalar <b>3</b></button><button className="primary"><Plus size={17} /> Yangi party</button></div></div><section className="stats-grid"><div className="stat-card glass-panel"><div className="stat-icon mint"><Users size={18} /></div><small>Faol o'quvchilar</small><strong>248</strong><span className="trend">+12.4% <small>shu hafta</small></span></div><div className="stat-card glass-panel"><div className="stat-icon coral"><Vote size={18} /></div><small>Jami ovozlar</small><strong>{total}</strong><span className="trend">+8.2% <small>kecha bilan</small></span></div><div className="stat-card glass-panel"><div className="stat-icon blue"><MessageCircle size={18} /></div><small>Yangi takliflar</small><strong>{suggestions.length}</strong><span className="trend">+5 <small>bugun</small></span></div><div className="stat-card glass-panel"><div className="stat-icon yellow"><Star size={18} /></div><small>O'rtacha reyting</small><strong>4.8</strong><span className="trend gold-text">+0.3 <small>shu oy</small></span></div></section><section className="dashboard-grid"><div className="dashboard-card glass-panel"><div className="section-head compact"><div><p className="eyebrow">OVOZLAR NATIJASI</p><h2>Keyingi party tanlovi</h2></div><button className="filter-button">12 iyun <ChevronDown size={14} /></button></div><div className="donut-wrap"><div className="donut"><div><strong>{total}</strong><small>JAMI OVOZ</small></div></div><div className="legend">{parties.map((party) => <div key={party.id}><span className={`legend-dot ${party.tone}`} /><span>{party.icon} {party.title}</span><strong>{Math.round(party.votes / total * 100)}%</strong></div>)}</div></div></div><div className="dashboard-card glass-panel live-ranking"><div className="section-head compact"><div><p className="eyebrow">REAL-TIME</p><h2>O'qituvchilar reytingi</h2></div><span className="pill-live"><span className="live-dot" /> LIVE</span></div>{teachers.map((teacher, index) => <div className="rank-row" key={teacher.name}><b className="rank">0{index + 1}</b><div className={`teacher-avatar ${teacher.color}`}>{teacher.initials}</div><div className="rank-name"><strong>{teacher.name}</strong><small>{teacher.subject}</small></div><div className="stars"><Star size={13} fill="currentColor" /> <strong>{teacherRatings[teacher.name] || teacher.rating}</strong></div><span className="rank-change">↗</span></div>)}</div></section><section className="dashboard-card glass-panel submissions"><div className="section-head compact"><div><p className="eyebrow">FEEDBACK HUB</p><h2>O'quvchilar fikri</h2></div><div className="tab-switch"><button className={tab === 'votes' ? 'active' : ''} onClick={() => setTab('votes')}><ListChecks size={15} /> Ovoz berganlar</button><button className={tab === 'suggestions' ? 'active' : ''} onClick={() => setTab('suggestions')}><Lightbulb size={15} /> Taklif berganlar</button></div></div>{tab === 'votes' ? <div className="people-table"><div className="table-row table-head"><span>O'quvchi</span><span>Tanlovi</span><span>Guruh</span><span>Vaqt</span></div>{['Aziza Karimova', 'Bekzod Ismoilov', 'Madina Tojiboyeva', 'Sardor Tursunov'].map((name, i) => <div className="table-row" key={name}><span><div className="small-avatar">{name.split(' ').map((x) => x[0]).join('')}</div><strong>{name}</strong></span><span>{parties[i % parties.length].icon} {parties[i % parties.length].title}</span><span>IELTS · 17:00</span><span className="muted">{i + 2} daqiqa oldin</span></div>)}</div> : <div className="people-table">{suggestions.map((item) => <div className="table-row suggestion-table" key={item.text}><span><div className="small-avatar">{item.author.split(' ').map((x) => x[0]).join('')}</div><strong>{item.author}</strong></span><span><Lightbulb size={14} /> {item.text}</span><span>{item.group}</span><button className="approve">Tasdiqlash</button></div>)}</div>}</section><section className="dashboard-card glass-panel create-party"><div><p className="eyebrow">KEYINGI HAFTA</p><h2>Yangi party qo'shish</h2><p className="muted">Tasdiqlangan taklifni keyingi ovoz berishga qo'shing.</p></div><div className="create-form"><input value={newParty} onChange={(e) => setNewParty(e.target.value)} placeholder="Party nomi..." /><button className="primary" onClick={() => { if (newParty.trim()) { onSetParty(newParty.trim()); setNewParty('') } }}><Plus size={16} /> Qo'shish</button></div></section></div>
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<App />)