'use client'

/**
 * app/opportunities/[id]/CadastrosTab.tsx
 *
 * Funde Personas e Documentos numa aba só.
 *
 * O motivo é aritmético: com Eventos entrando, seriam cinco abas no topo — e o
 * app é mobile-first, usado entre reuniões. A fusão também é conceitualmente
 * mais honesta que a divisão anterior: Personas e Documentos são as duas coisas
 * que o vendedor cadastra e mantém; Eventos é o que acontece.
 *
 * Mesmo padrão do InteligenciaHub: os componentes que já funcionam entram aqui
 * inteiros, sem alteração.
 */

import { useState } from 'react'
import PersonasTab from './PersonasTab'
import DocumentosTab from './DocumentosTab'

const SECOES = [
  { chave: 'personas', rotulo: 'Personas' },
  { chave: 'documentos', rotulo: 'Documentos' },
] as const

type Chave = (typeof SECOES)[number]['chave']

export default function CadastrosTab({
  opportunityId,
}: {
  opportunityId: string
}) {
  const [secao, setSecao] = useState<Chave>('personas')

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {SECOES.map((item) => (
          <button
            key={item.chave}
            type="button"
            onClick={() => setSecao(item.chave)}
            className={
              secao === item.chave
                ? 'whitespace-nowrap rounded-full bg-gray-900 px-4 py-1.5 text-xs font-medium text-white'
                : 'whitespace-nowrap rounded-full border border-gray-300 px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50'
            }
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {secao === 'personas' && <PersonasTab opportunityId={opportunityId} />}
      {secao === 'documentos' && <DocumentosTab opportunityId={opportunityId} />}
    </div>
  )
}