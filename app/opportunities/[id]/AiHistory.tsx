'use client'

/**
 * app/opportunities/[id]/AiHistory.tsx
 *
 * Histórico de versões para qualquer gerador de IA.
 *
 * A regra central: a lista de versões nunca é limpa. Enquanto uma geração roda,
 * o vendedor continua vendo o que já tinha — e quando a nova chega, ela entra no
 * topo sem apagar nada.
 *
 * O histórico é escopado por evento. Regerar a análise da reunião de setembro
 * não tem nada a ver com a de outubro, então cada reunião tem sua própria
 * sequência de versões. Análises rodadas sem reunião — para avaliar um material
 * antes de decidir se vale marcar conversa — formam uma sequência separada.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

export type VersaoIA = {
  id: string
  content: any
  created_at: string
  event_id: string | null
}

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* -------------------------------------------------------------------------- */
/* O hook                                                                      */
/* -------------------------------------------------------------------------- */

export function useHistoricoIA(
  opportunityId: string,
  outputType: string,
  eventId: string | null = null
) {
  // useMemo garante um único cliente por montagem do componente. Sem ele, cada
  // render criaria uma conexão nova e o useCallback abaixo nunca estabilizaria.
  const supabase = useMemo(() => createClient(), [])

  const [versoes, setVersoes] = useState<VersaoIA[]>([])
  const [indice, setIndice] = useState(0)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)

    let consulta = supabase
      .from('ai_outputs')
      .select('id, content, created_at, event_id')
      .eq('opportunity_id', opportunityId)
      .eq('output_type', outputType)

    // `.is(null)` e `.eq(id)` são coisas diferentes no Postgres: sem o ramo do
    // nulo, as análises soltas nunca apareceriam.
    consulta = eventId
      ? consulta.eq('event_id', eventId)
      : consulta.is('event_id', null)

    const { data } = await consulta.order('created_at', { ascending: false })

    setVersoes(data ?? [])
    setIndice(0)
    setCarregando(false)
  }, [supabase, opportunityId, outputType, eventId])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Chamado quando uma geração termina: a nova versão entra no topo. */
  const adicionarVersao = useCallback(
    (content: any, event_id: string | null = null) => {
      setVersoes((anteriores) => [
        {
          id: `local-${Date.now()}`,
          content,
          created_at: new Date().toISOString(),
          event_id,
        },
        ...anteriores,
      ])
      setIndice(0)
    },
    []
  )

  return {
    versoes,
    versaoAtual: versoes[indice] ?? null,
    indice,
    setIndice,
    carregando,
    adicionarVersao,
    recarregar: carregar,
  }
}

/* -------------------------------------------------------------------------- */
/* A navegação                                                                 */
/* -------------------------------------------------------------------------- */

type NavProps = {
  versoes: VersaoIA[]
  indice: number
  onMudar: (indice: number) => void
  /** Texto opcional dizendo a que reunião estas versões pertencem. */
  escopo?: string
}

export function NavegacaoVersoes({
  versoes,
  indice,
  onMudar,
  escopo,
}: NavProps) {
  if (versoes.length === 0) return null

  const atual = versoes[indice]
  const ehMaisRecente = indice === 0

  return (
    <div className="space-y-1 border-b border-gray-100 pb-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMudar(indice + 1)}
            disabled={indice >= versoes.length - 1}
            className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Versão anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => onMudar(indice - 1)}
            disabled={indice <= 0}
            className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Versão seguinte"
          >
            ›
          </button>
        </div>

        <span className="text-sm text-gray-600">
          Versão {versoes.length - indice} de {versoes.length}
          <span className="text-gray-400"> · {formatarData(atual.created_at)}</span>
        </span>

        {ehMaisRecente ? (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            mais recente
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onMudar(0)}
            className="text-xs font-medium text-[#185FA5] hover:underline"
          >
            ir para a mais recente
          </button>
        )}
      </div>

      {escopo && <p className="text-xs text-gray-400">{escopo}</p>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Blocos visuais reaproveitados pelas telas de IA                             */
/* -------------------------------------------------------------------------- */

export function TituloSecao({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </h4>
  )
}

export function AvisoIA() {
  return (
    <p className="text-xs text-gray-400">
      Conteúdo gerado por IA a partir dos dados que você cadastrou. Revise antes
      de usar em campo.
    </p>
  )
}

export function MensagemErro({ texto }: { texto: string }) {
  if (!texto) return null
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {texto}
    </div>
  )
}