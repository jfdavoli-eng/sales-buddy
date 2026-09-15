'use client'

/**
 * app/opportunities/[id]/InteligenciaHub.tsx
 *
 * A aba Inteligência é um hub com três geradores em vez de três abas novas.
 * Com quatro abas no topo, o app continua utilizável no celular — que é onde o
 * vendedor abre isto, entre uma reunião e outra.
 *
 * Quando o vendedor chega aqui pelo botão da aba Eventos, `eventoInicialId` vem
 * preenchido: o hub abre direto no Dry Run com a reunião escolhida.
 */

import { useEffect, useState } from 'react'
import AbordagemPanel from './AbordagemPanel'
import DryRunPanel from './DryRunPanel'
import MockingMeetingPanel from './MockingMeetingPanel'

const SECOES = [
  { chave: 'abordagem', rotulo: 'Abordagem & Próximos Passos' },
  { chave: 'mocking', rotulo: 'Mocking Meeting' },
  { chave: 'dryrun', rotulo: 'Dry Run' },
] as const

type Chave = (typeof SECOES)[number]['chave']

export default function InteligenciaHub({
  opportunityId,
  eventoInicialId = null,
}: {
  opportunityId: string
  eventoInicialId?: string | null
}) {
  const [secao, setSecao] = useState<Chave>(
    eventoInicialId ? 'dryrun' : 'abordagem'
  )

  // Se o vendedor já estiver nesta aba e clicar em outra reunião na aba
  // Eventos, o componente não remonta — daí o efeito.
  useEffect(() => {
    if (eventoInicialId) setSecao('dryrun')
  }, [eventoInicialId])

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SECOES.map((item) => (
          <button
            key={item.chave}
            type="button"
            onClick={() => setSecao(item.chave)}
            className={
              secao === item.chave
                ? 'whitespace-nowrap rounded-full bg-gray-900 px-4 py-1.5 text-sm font-medium text-white'
                : 'whitespace-nowrap rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50'
            }
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {secao === 'abordagem' && <AbordagemPanel opportunityId={opportunityId} />}

      {secao === 'mocking' && (
        <MockingMeetingPanel
          opportunityId={opportunityId}
          eventoInicialId={eventoInicialId}
        />
      )}

      {secao === 'dryrun' && (
        <DryRunPanel
          opportunityId={opportunityId}
          eventoInicialId={eventoInicialId}
        />
      )}
    </div>
  )
}