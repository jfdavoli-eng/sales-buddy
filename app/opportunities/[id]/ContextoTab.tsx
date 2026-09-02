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
 *
 * O bloco de contexto econômico é informação, não calculadora. A modelagem de
 * cenários ficou para a V2. Como lib/ai/server.ts monta o contexto lendo todas
 * as colunas de `opportunities`, estes campos alimentam os prompts assim que
 * são preenchidos — sem tocar em nenhuma rota de IA.
 */

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

/* -------------------------------------------------------------------------- */
/* Formatação                                                                  */
/* -------------------------------------------------------------------------- */

function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || (valor as any) === '') return '—'
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

function TextoLongo({
  valor,
  vazio,
}: {
  valor: string | null
  vazio: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
        {valor || <span className="text-gray-300">{vazio}</span>}
      </p>
    </div>
  )
}

/** Sub-bloco dentro de um card, usado no contexto econômico. */
function SubBloco({
  titulo,
  valor,
  vazio,
  ultimo,
}: {
  titulo: string
  valor: string | null
  vazio: string
  ultimo?: boolean
}) {
  return (
    <div className={`px-3 py-2.5 ${ultimo ? '' : 'border-b border-gray-100'}`}>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
        {titulo}
      </p>
      <p className="mt-1 text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
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

const textareaClasse = `${inputClasse} resize-y leading-relaxed`

/* -------------------------------------------------------------------------- */
/* O componente                                                                */
/* -------------------------------------------------------------------------- */

type Props = {
  opp: any
  /** Avisa a página para atualizar o cabeçalho (valor, empresa) após salvar. */
  onUpdated?: (opp: any) => void
}

function formDe(o: any) {
  return {
    company_name: o.company_name ?? '',
    estimated_value: o.estimated_value ?? '',
    expected_close_date: o.expected_close_date ?? '',
    context: o.context ?? '',
    company_experience: o.company_experience ?? '',
    products_services: o.products_services ?? '',
    industry_strategy: o.industry_strategy ?? '',
    budget_context: o.budget_context ?? '',
    commercial_constraints: o.commercial_constraints ?? '',
    payment_assumptions: o.payment_assumptions ?? '',
  }
}

export default function ContextoTab({ opp, onUpdated }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [dados, setDados] = useState(opp)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(formDe(opp))

  function abrirEdicao() {
    setForm(formDe(dados))
    setErro('')
    setEditando(true)
  }

  function campo(nome: keyof ReturnType<typeof formDe>) {
    return {
      value: (form as any)[nome],
      onChange: (e: any) => setForm({ ...form, [nome]: e.target.value }),
    }
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
    const texto = (v: string) => v.trim() || null

    const paraGravar = {
      company_name: form.company_name.trim(),
      estimated_value:
        form.estimated_value === '' ? null : Number(form.estimated_value),
      expected_close_date: form.expected_close_date || null,
      context: texto(form.context),
      company_experience: texto(form.company_experience),
      products_services: texto(form.products_services),
      industry_strategy: texto(form.industry_strategy),
      budget_context: texto(form.budget_context),
      commercial_constraints: texto(form.commercial_constraints),
      payment_assumptions: texto(form.payment_assumptions),
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
            <input type="text" {...campo('company_name')} className={inputClasse} />
          </Campo>

          <Campo rotulo="Valor estimado (R$)">
            <input
              type="number"
              inputMode="numeric"
              {...campo('estimated_value')}
              placeholder="250000"
              className={inputClasse}
            />
          </Campo>

          <Campo rotulo="Fechamento previsto">
            <input
              type="date"
              {...campo('expected_close_date')}
              className={inputClasse}
            />
          </Campo>

          <Campo
            rotulo="Contexto"
            dica="O que está em jogo, como o deal chegou até você, o que já foi conversado."
          >
            <textarea rows={4} {...campo('context')} className={textareaClasse} />
          </Campo>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
          <Campo
            rotulo="Experiência com a empresa"
            dica="Seu histórico pessoal com esta empresa ou com estas pessoas. É o dado que nenhum concorrente tem."
          >
            <textarea
              rows={4}
              {...campo('company_experience')}
              className={textareaClasse}
            />
          </Campo>

          <Campo
            rotulo="Produtos / Serviços desta oportunidade"
            dica="Só o que é específico deste deal. O portfólio geral fica em Configurações."
          >
            <textarea
              rows={3}
              {...campo('products_services')}
              className={textareaClasse}
            />
          </Campo>

          <Campo
            rotulo="Estratégia por indústria"
            dica="Setor do cliente, vocabulário do meio, dores típicas dos executivos dessa indústria."
          >
            <textarea
              rows={3}
              {...campo('industry_strategy')}
              className={textareaClasse}
            />
          </Campo>
        </div>

        <div>
          <Rotulo>Contexto econômico</Rotulo>
          <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
            <Campo
              rotulo="Orçamento e aprovações do cliente"
              dica="Quanto ele tem, quando o orçamento vira, quem aprova acima de qual valor."
            >
              <textarea
                rows={3}
                {...campo('budget_context')}
                placeholder="Ex.: verba de capex fecha em outubro; acima de R$ 300 mil precisa passar pelo conselho."
                className={textareaClasse}
              />
            </Campo>

            <Campo
              rotulo="Suas restrições comerciais"
              dica="Margem mínima, alçada de desconto, o que você pode e o que não pode oferecer."
            >
              <textarea
                rows={3}
                {...campo('commercial_constraints')}
                placeholder="Ex.: desconto até 8% sem aprovação; abaixo de 22% de margem não passa."
                className={textareaClasse}
              />
            </Campo>

            <Campo
              rotulo="Premissas de pagamento"
              dica="Prazo, parcelamento, moeda, condições já discutidas ou pretendidas."
              >
              <textarea
                rows={3}
                {...campo('payment_assumptions')}
                placeholder="Ex.: 30/60/90 na proposta; cliente pediu 120 dias na conversa anterior."
                className={textareaClasse}
              />
            </Campo>
          </div>
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------------- */
  /* Modo leitura                                                           */
  /* ---------------------------------------------------------------------- */

  const semEconomico =
    !dados.budget_context &&
    !dados.commercial_constraints &&
    !dados.payment_assumptions

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
        <TextoLongo valor={dados.industry_strategy} vazio="Não informada" />
      </div>

      <div>
        <Rotulo>Contexto econômico</Rotulo>
        {semEconomico ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center">
            <p className="text-[13px] text-gray-600">
              Nenhuma informação econômica registrada.
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[11px] text-gray-500">
              Orçamento, alçadas e condições de pagamento mudam como a IA lê a
              pressão por desconto e o ritmo do deal.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <SubBloco
              titulo="Orçamento e aprovações do cliente"
              valor={dados.budget_context}
              vazio="Não informado"
            />
            <SubBloco
              titulo="Suas restrições comerciais"
              valor={dados.commercial_constraints}
              vazio="Não informadas"
            />
            <SubBloco
              titulo="Premissas de pagamento"
              valor={dados.payment_assumptions}
              vazio="Não informadas"
              ultimo
            />
          </div>
        )}
      </div>
    </div>
  )
}