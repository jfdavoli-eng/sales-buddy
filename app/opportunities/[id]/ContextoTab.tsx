'use client'

/**
 * app/opportunities/[id]/ContextoTab.tsx
 *
 * Aba Contexto com dois modos: leitura e edição.
 *
 * A edição é destravada por um botão explícito, não inline campo a campo. Com
 * botão, a intenção do usuário fica clara e a gravação acontece quando ele
 * decide — não quando o dedo encosta na tela no celular.
 *
 * O que NÃO se edita aqui: estágio e resultado (WON/LOST). Os dois já têm
 * controle próprio no cabeçalho da página. Editar a mesma informação em dois
 * lugares é como as telas divergem com o tempo.
 */

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

/* -------------------------------------------------------------------------- */
/* Formatação                                                                  */
/* -------------------------------------------------------------------------- */

function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  // Coluna `date` vem como 'YYYY-MM-DD'. Montar com new Date(iso) aplicaria
  // fuso e poderia mostrar o dia anterior — por isso o split manual.
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/* -------------------------------------------------------------------------- */
/* Blocos de leitura                                                           */
/* -------------------------------------------------------------------------- */

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
      {children}
    </p>
  )
}

function Linha({
  rotulo,
  children,
  ultima,
}: {
  rotulo: string
  children: React.ReactNode
  ultima?: boolean
}) {
  return (
    <div
      className={`flex px-3 py-2.5 ${ultima ? '' : 'border-b border-gray-100'}`}
    >
      <span className="text-xs text-gray-400 w-32 shrink-0">{rotulo}</span>
      <span className="text-[13px] font-medium text-gray-900">{children}</span>
    </div>
  )
}

function TextoLongo({ valor, vazio }: { valor: string | null; vazio: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
        {valor || <span className="text-gray-300">{vazio}</span>}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Campos de edição                                                            */
/* -------------------------------------------------------------------------- */

function Campo({
  rotulo,
  children,
  dica,
}: {
  rotulo: string
  children: React.ReactNode
  dica?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{rotulo}</label>
      {children}
      {dica && <p className="mt-1 text-[11px] text-gray-400">{dica}</p>}
    </div>
  )
}

const inputClasse =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-[13px] focus:border-[#185FA5] focus:outline-none'

/* -------------------------------------------------------------------------- */
/* O componente                                                                */
/* -------------------------------------------------------------------------- */

type Props = {
  opp: any
  /** Avisa a página para atualizar o cabeçalho (valor, empresa) após salvar. */
  onUpdated?: (opp: any) => void
}

export default function ContextoTab({ opp, onUpdated }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [dados, setDados] = useState(opp)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    company_name: opp.company_name ?? '',
    estimated_value: opp.estimated_value ?? '',
    expected_close_date: opp.expected_close_date ?? '',
    context: opp.context ?? '',
    company_experience: opp.company_experience ?? '',
    products_services: opp.products_services ?? '',
    industry_strategy: opp.industry_strategy ?? '',
  })

  function abrirEdicao() {
    setForm({
      company_name: dados.company_name ?? '',
      estimated_value: dados.estimated_value ?? '',
      expected_close_date: dados.expected_close_date ?? '',
      context: dados.context ?? '',
      company_experience: dados.company_experience ?? '',
      products_services: dados.products_services ?? '',
      industry_strategy: dados.industry_strategy ?? '',
    })
    setErro('')
    setEditando(true)
  }

  async function salvar() {
    if (!form.company_name.trim()) {
      setErro('O nome da empresa não pode ficar em branco.')
      return
    }

    setSalvando(true)
    setErro('')

    // Campos opcionais vazios vão como null, não como string vazia: no banco,
    // '' e NULL são coisas diferentes, e o gerador de contexto da IA pula nulos.
    const paraGravar = {
      company_name: form.company_name.trim(),
      estimated_value:
        form.estimated_value === '' ? null : Number(form.estimated_value),
      expected_close_date: form.expected_close_date || null,
      context: form.context.trim() || null,
      company_experience: form.company_experience.trim() || null,
      products_services: form.products_services.trim() || null,
      industry_strategy: form.industry_strategy.trim() || null,
      updated_at: new Date().toISOString(),
    }

    // `.select()` no fim devolve a linha alterada. Sem política de UPDATE no
    // RLS, o Postgres não encontra linha para alterar e o retorno vem vazio,
    // sem erro. É assim que a falha silenciosa aparece.
    const { data, error } = await supabase
      .from('opportunities')
      .update(paraGravar)
      .eq('id', dados.id)
      .select()

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    if (!data || data.length === 0) {
      setErro(
        'A gravação não afetou nenhuma linha. Provavelmente falta a política de UPDATE em opportunities.'
      )
      return
    }

    setDados(data[0])
    onUpdated?.(data[0])
    setEditando(false)
  }

  /* ---------------------------------------------------------------------- */
  /* Modo edição                                                            */
  /* ---------------------------------------------------------------------- */

  if (editando) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Rotulo>Editando o deal</Rotulo>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditando(false)}
              disabled={salvando}
              className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="px-3 py-1.5 bg-[#185FA5] text-white rounded-md text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>

        {erro && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
            {erro}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
          <Campo rotulo="Empresa">
            <input
              type="text"
              value={form.company_name}
              onChange={(e) =>
                setForm({ ...form, company_name: e.target.value })
              }
              className={inputClasse}
            />
          </Campo>

          <Campo rotulo="Valor estimado (R$)">
            <input
              type="number"
              inputMode="numeric"
              value={form.estimated_value}
              onChange={(e) =>
                setForm({ ...form, estimated_value: e.target.value })
              }
              placeholder="250000"
              className={inputClasse}
            />
          </Campo>

          <Campo rotulo="Fechamento previsto">
            <input
              type="date"
              value={form.expected_close_date}
              onChange={(e) =>
                setForm({ ...form, expected_close_date: e.target.value })
              }
              className={inputClasse}
            />
          </Campo>

          <Campo
            rotulo="Contexto"
            dica="O que está em jogo, como o deal chegou até você, o que já foi conversado."
          >
            <textarea
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
              rows={4}
              className={`${inputClasse} resize-y leading-relaxed`}
            />
          </Campo>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
          <Campo
            rotulo="Experiência com a empresa"
            dica="Seu histórico pessoal com esta empresa ou com estas pessoas. É o dado que nenhum concorrente tem."
          >
            <textarea
              value={form.company_experience}
              onChange={(e) =>
                setForm({ ...form, company_experience: e.target.value })
              }
              rows={4}
              className={`${inputClasse} resize-y leading-relaxed`}
            />
          </Campo>

          <Campo
            rotulo="Produtos / Serviços desta oportunidade"
            dica="Só o que é específico deste deal. O portfólio geral fica em Configurações."
          >
            <textarea
              value={form.products_services}
              onChange={(e) =>
                setForm({ ...form, products_services: e.target.value })
              }
              rows={3}
              className={`${inputClasse} resize-y leading-relaxed`}
            />
          </Campo>

          <Campo
            rotulo="Estratégia por indústria"
            dica="Setor do cliente, vocabulário do meio, dores típicas dos executivos dessa indústria."
          >
            <textarea
              value={form.industry_strategy}
              onChange={(e) =>
                setForm({ ...form, industry_strategy: e.target.value })
              }
              rows={3}
              className={`${inputClasse} resize-y leading-relaxed`}
            />
          </Campo>
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------------- */
  /* Modo leitura                                                           */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <Rotulo>Dados do deal</Rotulo>
          <button
            type="button"
            onClick={abrirEdicao}
            className="mb-2 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-50"
          >
            Editar
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <Linha rotulo="Empresa">{dados.company_name}</Linha>
          <Linha rotulo="Valor estimado">
            {formatarMoeda(dados.estimated_value)}
          </Linha>
          <Linha rotulo="Fechamento prev.">
            {formatarData(dados.expected_close_date)}
          </Linha>
          <div className="flex px-3 py-2.5">
            <span className="text-xs text-gray-400 w-32 shrink-0">Contexto</span>
            <span className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
              {dados.context || (
                <span className="text-gray-300">Não informado</span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div>
        <Rotulo>Experiência com a empresa</Rotulo>
        <TextoLongo
          valor={dados.company_experience}
          vazio="Nenhuma experiência registrada"
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            Produtos / Serviços
          </p>
          <span className="text-[9px] font-semibold text-[#185FA5] bg-blue-50 px-1.5 py-0.5 rounded-full">
            Específico desta oportunidade
          </span>
        </div>
        <TextoLongo
          valor={dados.products_services}
          vazio="Usando o portfólio geral de Configurações"
        />
      </div>

      <div>
        <Rotulo>Estratégia por indústria</Rotulo>
        <TextoLongo
          valor={dados.industry_strategy}
          vazio="Não informada"
        />
      </div>
    </div>
  )
}