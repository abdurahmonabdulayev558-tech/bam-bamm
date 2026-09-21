// Backend API bilan ishlash uchun yordamchi modul.
// VITE_API_URL bo'lsa o'sha manzil, aks holda bir xil hostning /api yo'li.

const base = import.meta.env.VITE_API_URL || ''

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${base}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    // Server qaytargan xato kodini (masalan login_taken) ushlab qolamiz.
    let code = ''
    try { code = (await res.json())?.error || '' } catch { /* javob JSON emas */ }
    const err = new Error(code || `API ${res.status}: ${path}`) as Error & { status?: number; code?: string }
    err.status = res.status
    err.code = code
    throw err
  }
  return res.json()
}

export type ApiParty = { id: number; title: string; subtitle: string; icon: string; tone: string; votes: number }
export type ApiSuggestion = { text: string; author: string; group: string; teacher: string; votes: number; status: string }
export type ApiTeacher = { id: number; name: string; subject: string; initials: string; color: string; rating: number; votes: number; image?: string; login?: string; password?: string }
export type ApiVote = { name: string; party: string; teacher: string; time: number; voterId?: string }
export type ApiVisitorDay = { date: string; count: number }

export type ApiState = {
  parties: ApiParty[]
  teachers: ApiTeacher[]
  suggestions: ApiSuggestion[]
  votes: ApiVote[]
  visitorDays: ApiVisitorDay[]
  votingOpen: boolean
  deadline: number
}

export const api = {
  state: (): Promise<ApiState> => request('/state'),

  vote: (id: number, voter: string, teacher: string, voterId: string) =>
    request(`/parties/${id}/vote`, { method: 'POST', body: JSON.stringify({ voter, teacher, voterId }) }),

  myVote: (voterId: string): Promise<{ voted: boolean; vote: ApiVote | null }> =>
    request(`/votes/mine/${encodeURIComponent(voterId)}`),

  addParty: (title: string) =>
    request('/parties', { method: 'POST', body: JSON.stringify({ title }) }),

  resetVotes: () => request('/parties/reset', { method: 'POST' }),

  setVoting: (open: boolean) =>
    request('/settings/voting', { method: 'POST', body: JSON.stringify({ open }) }),

  addTeacher: (t: { name: string; subject: string; color?: string; image?: string; login: string; password: string }) =>
    request('/teachers', { method: 'POST', body: JSON.stringify(t) }),

  updateTeacher: (id: number, t: { name?: string; subject?: string; image?: string; login?: string; password?: string }) =>
    request(`/teachers/${id}`, { method: 'PUT', body: JSON.stringify(t) }),

  rateTeacher: (id: number, value: number) =>
    request(`/teachers/${id}/rate`, { method: 'POST', body: JSON.stringify({ value }) }),

  teacherLogin: (login: string, password: string): Promise<{ teacher: ApiTeacher }> =>
    request('/teachers/login', { method: 'POST', body: JSON.stringify({ login, password }) }),

  addSuggestion: (s: { text: string; teacher: string; author?: string; group?: string }) =>
    request('/suggestions', { method: 'POST', body: JSON.stringify(s) }),

  visitorHit: (visitorId: string, date: string): Promise<{ counted: boolean; count: number }> =>
    request('/visitors/hit', { method: 'POST', body: JSON.stringify({ visitorId, date }) }),
}
