'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

const STAGES = [
  { value: 'prospeccao', label: 'Prospecção' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'fechamento', label: 'Fechamento' },
]

export default function NewOpportunityPage() {
  const router = useRouter()
  const supabase = createClient()

  const [companyName, setCompanyName] = useState('')
  const [value, setValue] = useState('')
  const [stage, setStage] = useState('prospeccao')
  const [closeDate, setCloseDate] = useState('')
  const [context, setContext] = useState('')
  const [companyExperience, setCompanyExperience] = useState('')
  const [productsServices, setProductsServices] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function formatValueInput(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    return new Intl.NumberFormat('pt-BR').format(parseInt(digits, 10))
  }

  function parseValue(formatted: string): number | null {
    const digits = formatted.replace(/\D/g, '')
    return digits ? parseInt(digits, 10) : null
  }

  async function handleSave() {
    if (!companyName.trim()) {
      setError('O nome da empresa é obrigatório.')
      return
    }

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      setError('Perfil não encontrado.')
      setLoading(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('opportunities')
      .insert({
        organization_id: profile.organization_id,
        owner_id: user.id,
        company_name: companyName.trim(),
        estimated_value: parseValue(value),
        stage,
        expected_close_date: closeDate || null,
        context: context.trim() || null,
        company_experience: companyExperience.trim() || null,
        products_services: productsServices.trim() || null,
      })
      .select()
      .single()

    if (insertError) {
      setError('Erro ao salvar: ' + insertError.message)
      setLoading(false)
      return
    }

    router.push(`/opportunities/${data.id}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">

      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.push('/opportunities')}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
        >
          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">Nova oportunidade</h1>
      </header>

      <div className="max-w-2xl mx-auto p-4 pb-28">

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Empresa <span className="text-red-500">*</span>
          </label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Nome da empresa"
            className="w-full h-10 px-3 mb-4 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
          />

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Valor estimado</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                <input
                  value={value}
                  onChange={(e) => setValue(formatValueInput(e.target.value))}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-full h-10 pl-9 pr-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Estágio</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50 bg-white"
              >
                {STAGES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="block text-xs font-medium text-gray-600 mb-1.5">Fechamento previsto</label>
          <input
            type="date"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
            className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Contexto da oportunidade</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Motivação da compra, histórico, situação atual do cliente..."
            rows={4}
            className="w-full px-3 py-2.5 mb-4 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50 resize-none leading-relaxed"
          />

          <label className="block text-xs font-medium text-gray-600 mb-1.5">Experiência com a empresa</label>
          <textarea
            value={companyExperience}
            onChange={(e) => setCompanyExperience(e.target.value)}
            placeholder="O que você já sabe sobre essa empresa? Deals anteriores, relacionamentos, cultura..."
            rows={4}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50 resize-none leading-relaxed"
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-600">
              Produtos / Serviços <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            {productsServices.trim() && (
              <span className="text-[10px] font-semibold text-[#185FA5] bg-blue-50 px-2 py-0.5 rounded-full">
                Sobrepõe global
              </span>
            )}
          </div>
          <textarea
            value={productsServices}
            onChange={(e) => setProductsServices(e.target.value)}
            placeholder="Deixe em branco para usar a descrição padrão das Configurações..."
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50 resize-none leading-relaxed"
          />
          <p className="text-[11px] text-gray-400 mt-2 flex items-start gap-1.5">
            <svg className="w-3 h-3 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            Se preenchido, sobrepõe a descrição global apenas para esta oportunidade
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-3 px-1">{error}</p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button
            onClick={() => router.push('/opportunities')}
            className="flex-1 h-11 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-[2] h-11 bg-[#1B3A6B] hover:bg-[#152d54] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? 'Salvando...' : 'Salvar oportunidade'}
          </button>
        </div>
      </div>
    </div>
  )
}