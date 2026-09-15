'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import CadastrosTab from './CadastrosTab'
import EventosTab from './EventosTab'
import InteligenciaHub from './InteligenciaHub'
import ContextoTab from './ContextoTab'

type Opportunity = {
  id: string
  company_name: string
  estimated_value: number | null
  stage: string
  outcome: string | null
  expected_close_date: string | null
  context: string | null
  company_experience: string | null
  products_services: string | null
  industry_strategy: string | null
  created_at: string
}

const STAGES = [
  { key: 'prospeccao', label: 'Prospecção' },
  { key: 'qualificacao', label: 'Qualificação' },
  { key: 'proposta', label: 'Proposta' },
  { key: 'negociacao', label: 'Negociação' },
  { key: 'fechamento', label: 'Fechamento' },
]

const STAGE_BADGE: Record<string, string> = {
  prospeccao: 'bg-[#F1EFE8] text-[#444441]',
  qualificacao: 'bg-[#E6F1FB] text-[#0C447C]',
  proposta: 'bg-[#FAEEDA] text-[#633806]',
  negociacao: 'bg-[#EEEDFE] text-[#3C3489]',
  fechamento: 'bg-[#E1F5EE] text-[#085041]',
}

const TABS = [
  { key: 'contexto', label: 'Contexto' },
  { key: 'cadastros', label: 'Cadastros' },
  { key: 'eventos', label: 'Eventos' },
  { key: 'inteligencia', label: 'Inteligência' },
]

function formatCurrency(value: number | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Sem data prevista'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export default function OpportunityDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [activeTab, setActiveTab] = useState('contexto')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [dryRunEventoId, setDryRunEventoId] = useState<string | null>(null)
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', id)
        .single()

      if (!data) { router.push('/opportunities'); return }

      setOpp(data)
      setLoading(false)
    }
    load()
  }, [id])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function updateStage(newStage: string) {
    if (!opp || saving) return
    setSaving(true)
    const { error } = await supabase
      .from('opportunities')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', opp.id)

    if (!error) {
      setOpp({ ...opp, stage: newStage })
      showToast('Estágio atualizado: ' + STAGES.find(s => s.key === newStage)?.label)
    }
    setSaving(false)
  }

  async function updateOutcome(outcome: 'won' | 'lost') {
    if (!opp || saving) return
    setSaving(true)
    const newOutcome = opp.outcome === outcome ? null : outcome
    const { error } = await supabase
      .from('opportunities')
      .update({ outcome: newOutcome, updated_at: new Date().toISOString() })
      .eq('id', opp.id)

    if (!error) {
      setOpp({ ...opp, outcome: newOutcome })
      showToast(
        newOutcome === 'won' ? 'Oportunidade marcada como WON'
        : newOutcome === 'lost' ? 'Oportunidade marcada como LOST'
        : 'Marcação removida'
      )
    }
    setSaving(false)
  }

  if (loading || !opp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  const currentStageIdx = STAGES.findIndex(s => s.key === opp.stage)

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-2.5">
            <button
              onClick={() => router.push('/opportunities')}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 shrink-0"
            >
              <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-base font-semibold text-gray-900 flex-1 truncate">
              {opp.company_name}
            </h1>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-[#1B3A6B]">
                {formatCurrency(opp.estimated_value)}
              </span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STAGE_BADGE[opp.stage]}`}>
                {STAGES.find(s => s.key === opp.stage)?.label}
              </span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => updateOutcome('won')}
                className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                  opp.outcome === 'won'
                    ? 'bg-[#EAF3DE] text-[#27500A] border-[#3B6D11]'
                    : 'text-[#27500A] border-[#C0DD97] hover:bg-[#EAF3DE]'
                }`}
              >
                WON
              </button>
              <button
                onClick={() => updateOutcome('lost')}
                className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                  opp.outcome === 'lost'
                    ? 'bg-[#FCEBEB] text-[#791F1F] border-[#A32D2D]'
                    : 'text-[#791F1F] border-[#F7C1C1] hover:bg-[#FCEBEB]'
                }`}
              >
                LOST
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex items-start">
            {STAGES.map((s, i) => {
              const done = i < currentStageIdx
              const active = i === currentStageIdx
              return (
                <div key={s.key} className="flex items-start flex-1 min-w-0">
                  <button
                    onClick={() => updateStage(s.key)}
                    className="flex flex-col items-center flex-1 min-w-0 group"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      done ? 'bg-[#0F6E56] border-[#0F6E56]'
                      : active ? 'bg-[#1B3A6B] border-[#1B3A6B] ring-4 ring-[#1B3A6B]/15'
                      : 'bg-white border-gray-200 group-hover:border-gray-400'
                    }`}>
                      {done && (
                        <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2,6 5,9 10,3" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-[9px] mt-1 text-center leading-tight ${
                      done ? 'text-[#0F6E56] font-semibold'
                      : active ? 'text-[#1B3A6B] font-bold'
                      : 'text-gray-400'
                    }`}>
                      {s.label}
                    </span>
                  </button>
                  {i < STAGES.length - 1 && (
                    <div className={`h-0.5 flex-1 mt-2.5 -mx-1 ${
                      i < currentStageIdx ? 'bg-[#0F6E56]' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="max-w-2xl mx-auto flex border-t border-gray-200">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'text-[#1B3A6B] border-[#1B3A6B]'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">

      {activeTab === 'contexto' && <ContextoTab opp={opp} onUpdated={setOpp} />}
        {activeTab === 'cadastros' && <CadastrosTab opportunityId={opp.id} />}
        {activeTab === 'eventos' && (
  <EventosTab
    opportunityId={opp.id}
    onGerarDryRun={(id) => { setDryRunEventoId(id); setActiveTab('inteligencia') }}
  />
)}
        {activeTab === 'inteligencia' && (
  <InteligenciaHub opportunityId={opp.id} eventoInicialId={dryRunEventoId} />
)}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[13px] px-4 py-2 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}