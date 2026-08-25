'use client'

/**
 * app/opportunities/[id]/InteligenciaHub.tsx
 *
 * A aba Inteligência vira um hub com três geradores em vez de virar três abas
 * novas. Com quatro abas no topo (Contexto, Personas, Documentos, Inteligência)
 * o app continua utilizável no celular — que é onde o vendedor abre isto, entre
 * uma reunião e outra.
 *
 * O InteligenciaTab que já funciona não foi tocado: ele entra aqui inteiro.
 */

import { useState } from 'react'
import InteligenciaTab from './InteligenciaTab'
import DryRunPanel from './DryRunPanel'

const SECOES = [
  { chave: 'analise', rotulo: 'Análise & Roteiro' },
  { chave: 'mocking', rotulo: 'Mocking Meeting' },
  { chave: 'dryrun', rotulo: 'Dry Run' },
] as const

type Chave = (typeof SECOES)[number]['chave']

export default function InteligenciaHub({
  opportunityId,
}: {
  opportunityId: string
}) {
  const [secao, setSecao] = useState<Chave>('analise')

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

      {secao === 'analise' && <InteligenciaTab opportunityId={opportunityId} />}

      {secao === 'mocking' && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-700">Mocking Meeting</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">
            Próxima entrega. A IA vai simular como cada persona reage ao seu
            pitch — objeções, linguagem e postura de cada uma.
          </p>
        </div>
      )}

      {secao === 'dryrun' && <DryRunPanel opportunityId={opportunityId} />}
    </div>
  )
}