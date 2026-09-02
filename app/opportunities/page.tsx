'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Opportunity = {
  id: string
  company_name: string
  estimated_value: number | null
  stage: string
  outcome: string | null
  expected_close_date: string | null
  created_at: string
}

const STAGES = [
  { key: 'todas', label: 'Todas' },
  { key: 'prospeccao', label: 'Prospecção' },
  { key: 'qualificacao', label: 'Qualificação' },
  { key: 'proposta', label: 'Proposta' },
  { key: 'negociacao', label: 'Negociação' },
  { key: 'fechamento', label: 'Fechamento' },
]

const STAGE_STYLES: Record<string, { badge: string; bar: string; label: string }> = {
  prospeccao: { badge: 'bg-[#F1EFE8] text-[#444441]', bar: 'bg-[#888780]', label: 'Prospecção' },
  qualificacao: { badge: 'bg-[#E6F1FB] text-[#0C447C]', bar: 'bg-[#185FA5]', label: 'Qualificação' },
  proposta: { badge: 'bg-[#FAEEDA] text-[#633806]', bar: 'bg-[#854F0B]', label: 'Proposta' },
  negociacao: { badge: 'bg-[#EEEDFE] text-[#3C3489]', bar: 'bg-[#534AB7]', label: 'Negociação' },
  fechamento: { badge: 'bg-[#E1F5EE] text-[#085041]', bar: 'bg-[#0F6E56]', label: 'Fechamento' },
}

function formatCurrency(value: number | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'hoje'
  return `${days}d`
}

export default function OpportunitiesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [activeStage, setActiveStage] = useState('todas')
  const [search, setSearch] = useState('')
  

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, organizations(name)')
        .eq('id', user.id)
        .single()

      setProfile(profileData)

      const { data: opps } = await supabase
        .from('opportunities')
        .select('*')
        .order('created_at', { ascending: false })

      setOpportunities(opps || [])
      setLoading(false)
    }
    load()
  }, [])

  const active = opportunities.filter(o => !o.outcome)
  const wonCount = opportunities.filter(o => o.outcome === 'won').length
  const lostCount = opportunities.filter(o => o.outcome === 'lost').length

  const filtered = active.filter(o => {
    const matchStage = activeStage === 'todas' || o.stage === activeStage
    const matchSearch = o.company_name.toLowerCase().includes(search.toLowerCase())
    return matchStage && matchSearch
  })

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '??'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      <header className="bg-white border-b border-gray-200 px-4 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1B3A6B] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M10 2C6 2 3 5 3 9c0 2.4 1.1 4.5 2.8 5.9L5 17h10l-.8-2.1C15.9 13.5 17 11.4 17 9c0-4-3-7-7-7z" />
              <path d="M7 9h6M8 12h4" />
            </svg>
          </div>
          <span className="text-base font-semibold text-[#1B3A6B] tracking-tight">Sales Buddy</span>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-xs font-semibold text-[#1B3A6B]"
        >
          {initials}
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4">

        <div className="pt-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 h-10">
            <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar oportunidade ou empresa..."
              className="flex-1 text-sm outline-none bg-transparent"
            />
          </div>
        </div>

        <div className="flex gap-1.5 py-3 overflow-x-auto scrollbar-hide">
          {STAGES.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveStage(s.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeStage === s.key
                  ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 pb-3">
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-gray-400">Em andamento</p>
            <p className="text-lg font-semibold text-gray-900">{active.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-gray-400">WON</p>
            <p className="text-lg font-semibold text-[#27500A]">{wonCount}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-gray-400">LOST</p>
            <p className="text-lg font-semibold text-[#791F1F]">{lostCount}</p>
          </div>
        </div>

        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Oportunidades ativas
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400 mb-1">Nenhuma oportunidade encontrada</p>
            <p className="text-xs text-gray-400">
              {search || activeStage !== 'todas'
                ? 'Tente ajustar os filtros'
                : 'Crie sua primeira oportunidade no botão abaixo'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(opp => {
              const style = STAGE_STYLES[opp.stage] || STAGE_STYLES.prospeccao
              return (
                <button
                  key={opp.id}
                  onClick={() => router.push(`/opportunities/${opp.id}`)}
                  className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors text-left flex"
                >
                  <div className={`w-1 shrink-0 ${style.bar}`} />
                  <div className="flex-1 px-3 py-3">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">{opp.company_name}</span>
                      <span className="text-sm font-semibold text-[#1B3A6B]">
                        {formatCurrency(opp.estimated_value)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {opp.expected_close_date
                          ? `Fecha em ${new Date(opp.expected_close_date).toLocaleDateString('pt-BR')}`
                          : 'Sem data prevista'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
                          {style.label}
                        </span>
                        <span className="text-[11px] text-gray-400">{daysAgo(opp.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => router.push('/opportunities/new')}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#1B3A6B] hover:bg-[#152d54] shadow-lg flex items-center justify-center transition-colors"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  )
}