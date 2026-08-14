'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type OutputType = 'analise_qualitativa' | 'roteiro'

type AnaliseContent = {
  resumo?: string
  pontos_fortes?: { titulo: string; detalhe: string }[]
  riscos?: { titulo: string; detalhe: string; severidade?: string }[]
  acoes?: { titulo: string; detalhe: string; prazo?: string }[]
  lacunas?: string[]
}

type RoteiroContent = {
  resumo?: string
  abertura?: string
  mensagens_chave?: { titulo: string; detalhe: string }[]
  por_persona?: { persona: string; angulo: string; cuidado: string }[]
  perguntas?: string[]
  objecoes?: { objecao: string; resposta: string }[]
  proximos_passos?: string[]
}

type StoredOutput = {
  output_type: string
  content: unknown
  created_at: string | null
}

type Props = {
  opportunityId: string
}

const SEVERITY_BADGE: Record<string, string> = {
  alto: 'bg-[#FDECEC] text-[#8C1D1D]',
  medio: 'bg-[#FAEEDA] text-[#633806]',
  baixo: 'bg-[#F1EFE8] text-[#444441]',
}

const PRAZO_LABEL: Record<string, string> = {
  imediato: 'Imediato',
  curto: 'Curto prazo',
  medio: 'Médio prazo',
}

function formatWhen(value: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h4>
  )
}

export default function InteligenciaTab({ opportunityId }: Props) {
  const supabase = createClient()

  const [analise, setAnalise] = useState<AnaliseContent | null>(null)
  const [roteiro, setRoteiro] = useState<RoteiroContent | null>(null)
  const [analiseAt, setAnaliseAt] = useState<string | null>(null)
  const [roteiroAt, setRoteiroAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<OutputType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadStored = useCallback(async () => {
    const { data } = await supabase
      .from('ai_outputs')
      .select('output_type, content, created_at')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })

    const rows = (data ?? []) as StoredOutput[]

    const lastAnalise = rows.find((r) => r.output_type === 'analise_qualitativa')
    const lastRoteiro = rows.find((r) => r.output_type === 'roteiro')

    if (lastAnalise) {
      setAnalise(lastAnalise.content as AnaliseContent)
      setAnaliseAt(lastAnalise.created_at)
    }
    if (lastRoteiro) {
      setRoteiro(lastRoteiro.content as RoteiroContent)
      setRoteiroAt(lastRoteiro.created_at)
    }
    setLoading(false)
  }, [supabase, opportunityId])

  useEffect(() => {
    loadStored()
  }, [loadStored])

  async function generate(outputType: OutputType) {
    setGenerating(outputType)
    setError(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setError('Sessão expirada. Faça login novamente.')
      setGenerating(null)
      return
    }

    try {
      const res = await fetch('/api/inteligencia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ opportunityId, outputType }),
      })

      const payload = await res.json()

      if (!res.ok) {
        setError(payload.error ?? 'Não foi possível gerar agora.')
        setGenerating(null)
        return
      }

      const now = new Date().toISOString()
      if (outputType === 'analise_qualitativa') {
        setAnalise(payload.content as AnaliseContent)
        setAnaliseAt(now)
      } else {
        setRoteiro(payload.content as RoteiroContent)
        setRoteiroAt(now)
      }
    } catch {
      setError('Falha de conexão. Verifique se o servidor está no ar.')
    }

    setGenerating(null)
  }

  function Header({
    title,
    description,
    type,
    generatedAt,
    hasContent,
  }: {
    title: string
    description: string
    type: OutputType
    generatedAt: string | null
    hasContent: boolean
  }) {
    const busy = generating === type
    return (
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
          {generatedAt && (
            <p className="mt-1 text-xs text-gray-400">Gerado em {formatWhen(generatedAt)}</p>
          )}
        </div>
        <button
          onClick={() => generate(type)}
          disabled={busy || generating !== null}
          className="shrink-0 rounded-lg bg-[#0C447C] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a3763] disabled:opacity-50"
        >
          {busy ? 'Gerando…' : hasContent ? 'Gerar novamente' : 'Gerar'}
        </button>
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Carregando…</p>
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg bg-[#FDECEC] px-4 py-3 text-sm text-[#8C1D1D]">
          {error}
        </div>
      )}

      {/* Análise Qualitativa */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <Header
          title="Análise Qualitativa"
          description="Pontos fortes, riscos e ações recomendadas para avançar o deal."
          type="analise_qualitativa"
          generatedAt={analiseAt}
          hasContent={!!analise}
        />

        {!analise ? (
          <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            Ainda não há análise para esta oportunidade.
          </p>
        ) : (
          <div className="space-y-5">
            {analise.resumo && <p className="text-sm leading-relaxed text-gray-700">{analise.resumo}</p>}

            {!!analise.pontos_fortes?.length && (
              <div>
                <SectionTitle>Pontos fortes</SectionTitle>
                <ul className="space-y-2">
                  {analise.pontos_fortes.map((item, i) => (
                    <li key={i} className="rounded-lg border border-gray-200 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{item.titulo}</p>
                      <p className="mt-1 text-sm text-gray-600">{item.detalhe}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!!analise.riscos?.length && (
              <div>
                <SectionTitle>Riscos</SectionTitle>
                <ul className="space-y-2">
                  {analise.riscos.map((item, i) => (
                    <li key={i} className="rounded-lg border border-gray-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-gray-900">{item.titulo}</p>
                        {item.severidade && (
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${
                              SEVERITY_BADGE[item.severidade] ?? SEVERITY_BADGE.baixo
                            }`}
                          >
                            {item.severidade}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{item.detalhe}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!!analise.acoes?.length && (
              <div>
                <SectionTitle>Ações recomendadas</SectionTitle>
                <ul className="space-y-2">
                  {analise.acoes.map((item, i) => (
                    <li key={i} className="rounded-lg border border-gray-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-gray-900">{item.titulo}</p>
                        {item.prazo && (
                          <span className="shrink-0 rounded bg-[#E6F1FB] px-2 py-0.5 text-[11px] font-semibold text-[#0C447C]">
                            {PRAZO_LABEL[item.prazo] ?? item.prazo}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{item.detalhe}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!!analise.lacunas?.length && (
              <div>
                <SectionTitle>Informação que falta</SectionTitle>
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                  {analise.lacunas.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Roteiro de Abordagem */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <Header
          title="Roteiro de Abordagem"
          description="Argumentação, perguntas e próximos passos para a próxima conversa."
          type="roteiro"
          generatedAt={roteiroAt}
          hasContent={!!roteiro}
        />

        {!roteiro ? (
          <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            Ainda não há roteiro para esta oportunidade.
          </p>
        ) : (
          <div className="space-y-5">
            {roteiro.resumo && <p className="text-sm leading-relaxed text-gray-700">{roteiro.resumo}</p>}

            {roteiro.abertura && (
              <div>
                <SectionTitle>Abertura</SectionTitle>
                <p className="rounded-lg bg-[#E6F1FB] px-4 py-3 text-sm text-[#0C447C]">
                  {roteiro.abertura}
                </p>
              </div>
            )}

            {!!roteiro.mensagens_chave?.length && (
              <div>
                <SectionTitle>Mensagens-chave</SectionTitle>
                <ul className="space-y-2">
                  {roteiro.mensagens_chave.map((item, i) => (
                    <li key={i} className="rounded-lg border border-gray-200 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{item.titulo}</p>
                      <p className="mt-1 text-sm text-gray-600">{item.detalhe}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!!roteiro.por_persona?.length && (
              <div>
                <SectionTitle>Por pessoa</SectionTitle>
                <ul className="space-y-2">
                  {roteiro.por_persona.map((item, i) => (
                    <li key={i} className="rounded-lg border border-gray-200 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{item.persona}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        <span className="font-medium text-gray-700">Enfatizar:</span> {item.angulo}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        <span className="font-medium text-gray-700">Evitar:</span> {item.cuidado}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!!roteiro.objecoes?.length && (
              <div>
                <SectionTitle>Objeções prováveis</SectionTitle>
                <ul className="space-y-2">
                  {roteiro.objecoes.map((item, i) => (
                    <li key={i} className="rounded-lg border border-gray-200 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">“{item.objecao}”</p>
                      <p className="mt-1 text-sm text-gray-600">{item.resposta}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!!roteiro.perguntas?.length && (
              <div>
                <SectionTitle>Perguntas para fazer</SectionTitle>
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                  {roteiro.perguntas.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {!!roteiro.proximos_passos?.length && (
              <div>
                <SectionTitle>Próximos passos</SectionTitle>
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                  {roteiro.proximos_passos.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-400">
        Conteúdo gerado por IA a partir dos dados que você cadastrou. Revise antes de usar em campo.
      </p>
    </div>
  )
}