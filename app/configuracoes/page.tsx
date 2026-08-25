'use client'

/**
 * app/configuracoes/page.tsx
 *
 * Configurações da organização. No MVP tem um único campo: a descrição do que
 * a empresa vende (requisito A5).
 *
 * Por que isto importa mais do que parece: até agora todas as análises
 * inferiram o portfólio a partir do PDF anexado. Funcionou porque o material
 * era um catálogo. Numa proposta comercial, ou num Mocking Meeting sem
 * documento, a IA não teria de onde tirar o que você vende. Este campo alimenta
 * os quatro geradores de uma vez.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

export default function ConfiguracoesPage() {
  const supabase = useMemo(() => createClient(), [])

  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgNome, setOrgNome] = useState('')
  const [contexto, setContexto] = useState('')
  const [contextoSalvo, setContextoSalvo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  /* ---------------------------------------------------------------------- */
  /* Carregamento                                                           */
  /* ---------------------------------------------------------------------- */

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')

    // A política de SELECT em organizations é `id = auth_org_id()`, então esta
    // consulta já devolve apenas a organização do usuário logado. Não é preciso
    // passar por profiles para descobrir o vínculo — o RLS faz esse trabalho.
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .maybeSingle()

    if (error || !data) {
      setErro(
        'Não foi possível carregar sua organização. Se acabou de entrar, recarregue a página.'
      )
      setCarregando(false)
      return
    }

    setOrgId(data.id)
    setOrgNome(data.name ?? '')
    setContexto(data.product_context ?? '')
    setContextoSalvo(data.product_context ?? '')
    setCarregando(false)
  }, [supabase])

  useEffect(() => {
    carregar()
  }, [carregar])

  /* ---------------------------------------------------------------------- */
  /* Gravação                                                               */
  /* ---------------------------------------------------------------------- */

  async function salvar() {
    if (!orgId) return

    setSalvando(true)
    setErro('')
    setSucesso(false)

    // `.select()` no fim é proposital: devolve a linha atualizada. Se a política
    // de UPDATE não existir, o Postgres não encontra linha para alterar e o
    // retorno vem vazio — sem erro. É assim que se detecta a falha silenciosa.
    const { data, error } = await supabase
      .from('organizations')
      .update({ product_context: contexto })
      .eq('id', orgId)
      .select()

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    if (!data || data.length === 0) {
      setErro(
        'A gravação não afetou nenhuma linha. A política de UPDATE em organizations provavelmente não foi criada — rode o SQL da migração.'
      )
      return
    }

    setContextoSalvo(contexto)
    setSucesso(true)
    setTimeout(() => setSucesso(false), 3000)
  }

  const temMudanca = contexto !== contextoSalvo

  /* ---------------------------------------------------------------------- */
  /* Tela                                                                   */
  /* ---------------------------------------------------------------------- */

  if (carregando) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-400">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          ‹ Voltar
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Configurações</h1>
      </div>

      {orgNome && (
        <p className="mb-6 text-sm text-gray-500">
          Organização: <span className="font-medium text-gray-700">{orgNome}</span>
        </p>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">
          O que a sua empresa vende
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Este texto entra em todas as análises de IA — Dry Run, Mocking Meeting,
          Abordagem e Próximos Passos. Escreva uma vez, vale para todos os deals.
        </p>

        <textarea
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
          rows={12}
          placeholder={
            'Descreva o portfólio, o cliente típico e o que te diferencia.\n\nPode usar tópicos:\n- Câmeras corporais 4G/5G e sistemas de vigilância de longo alcance\n- Modelo ODM/white-label: o cliente vende sob a própria marca\n- Vendemos para fabricantes de eletrônicos, integradores e governo\n- Diferencial: customização de firmware em volumes que os grandes não atendem\n- Não fazemos: instalação, operação ou serviço de monitoramento'
          }
          className="mt-4 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
        />

        <p className="mt-1 text-xs text-gray-400">
          Inclua também o que você <em>não</em> vende. Saber o limite do
          portfólio evita que a IA sugira argumentos que você não pode sustentar.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !temMudanca}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>

          {sucesso && (
            <span className="text-sm text-green-700">Salvo.</span>
          )}
          {temMudanca && !salvando && !sucesso && (
            <span className="text-sm text-gray-400">
              Há alterações não salvas.
            </span>
          )}
        </div>

        {erro && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}
      </section>
    </div>
  )
}