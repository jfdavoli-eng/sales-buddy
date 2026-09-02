'use client'

/**
 * app/opportunities/[id]/DryRunPanel.tsx
 *
 * Dry Run: o vendedor escolhe um material já enviado, diz de que reunião se
 * trata, e a IA antecipa o que vai acontecer.
 *
 * A reunião é opcional. Selecionada, ela traz o objetivo e os participantes já
 * preenchidos — o vendedor escreveu isso uma vez ao registrar o evento e não
 * deveria escrever de novo. Sem reunião, o Dry Run continua servindo para
 * avaliar um material antes de decidir se vale marcar conversa.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import {
  useHistoricoIA,
  NavegacaoVersoes,
  TituloSecao,
  AvisoIA,
  MensagemErro,
} from './AiHistory'

const OUTPUT_TYPE = 'dryrun'

type Documento = {
  id: string
  file_name: string
  mime_type: string | null
  file_size: number | null
}

type Persona = { id: string; rotulo: string }

type Reuniao = {
  id: string
  title: string
  occurred_at: string
  objective: string | null
  event_personas: { persona_id: string }[] | null
}

function rotularPersona(p: any, i: number): string {
  return p.name ?? p.nome ?? p.full_name ?? p.contact_name ?? `Persona ${i + 1}`
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function DryRunPanel({
  opportunityId,
  eventoInicialId = null,
}: {
  opportunityId: string
  eventoInicialId?: string | null
}) {
  const supabase = useMemo(() => createClient(), [])

  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [reunioes, setReunioes] = useState<Reuniao[]>([])

  const [documentoId, setDocumentoId] = useState('')
  const [reuniaoId, setReuniaoId] = useState<string>(eventoInicialId ?? '')
  const [personasSelecionadas, setPersonasSelecionadas] = useState<string[]>([])
  const [objetivo, setObjetivo] = useState('')

  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const [carregandoInsumos, setCarregandoInsumos] = useState(true)

  const historico = useHistoricoIA(
    opportunityId,
    OUTPUT_TYPE,
    reuniaoId || null
  )

  /* ---------------------------------------------------------------------- */
  /* Carregamento                                                           */
  /* ---------------------------------------------------------------------- */

  const carregarInsumos = useCallback(async () => {
    setCarregandoInsumos(true)

    const [docs, pers, evs] = await Promise.all([
      supabase
        .from('documents')
        .select('id, file_name, mime_type, file_size')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false }),
      supabase.from('personas').select('*').eq('opportunity_id', opportunityId),
      supabase
        .from('events')
        .select('id, title, occurred_at, objective, event_personas(persona_id)')
        .eq('opportunity_id', opportunityId)
        .eq('type', 'reuniao')
        .order('occurred_at', { ascending: false }),
    ])

    const somentePdf = (docs.data ?? []).filter(
      (d: Documento) =>
        d.mime_type === 'application/pdf' ||
        d.file_name?.toLowerCase().endsWith('.pdf')
    )

    const listaPersonas: Persona[] = (pers.data ?? []).map(
      (p: any, i: number) => ({ id: p.id, rotulo: rotularPersona(p, i) })
    )

    setDocumentos(somentePdf)
    setPersonas(listaPersonas)
    setReunioes((evs.data as any) ?? [])
    setCarregandoInsumos(false)

    // Todas as personas marcadas por padrão quando não há reunião escolhida: o
    // caso comum é o comitê inteiro, e desmarcar é mais rápido que marcar.
    if (!reuniaoId) {
      setPersonasSelecionadas(listaPersonas.map((p) => p.id))
    }
  }, [supabase, opportunityId, reuniaoId])

  useEffect(() => {
    carregarInsumos()
    // Só na montagem: recarregar a cada troca de reunião seria desperdício.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId])

  /* ---------------------------------------------------------------------- */
  /* Seleção de reunião                                                     */
  /* ---------------------------------------------------------------------- */

  const aplicarReuniao = useCallback(
    (id: string) => {
      setReuniaoId(id)
      setErro('')

      if (!id) {
        setObjetivo('')
        setPersonasSelecionadas(personas.map((p) => p.id))
        return
      }

      const reuniao = reunioes.find((r) => r.id === id)
      if (!reuniao) return

      setObjetivo(reuniao.objective ?? '')

      const participantes = (reuniao.event_personas ?? []).map(
        (ep) => ep.persona_id
      )
      // Reunião sem participantes marcados: melhor todas do que nenhuma.
      setPersonasSelecionadas(
        participantes.length > 0 ? participantes : personas.map((p) => p.id)
      )
    },
    [personas, reunioes]
  )

  // Quando a tela é aberta a partir do botão da aba Eventos, a reunião já vem
  // escolhida — mas só dá para preencher os campos depois que as listas chegam.
  useEffect(() => {
    if (eventoInicialId && !carregandoInsumos && reunioes.length > 0) {
      aplicarReuniao(eventoInicialId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoInicialId, carregandoInsumos, reunioes.length])

  /* ---------------------------------------------------------------------- */
  /* Geração                                                                */
  /* ---------------------------------------------------------------------- */

  async function gerar() {
    if (!documentoId) {
      setErro('Escolha o material que quer analisar.')
      return
    }

    setErro('')
    setGerando(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setErro('Sessão expirada. Entre de novo para continuar.')
        return
      }

      const resposta = await fetch('/api/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          opportunityId,
          documentId: documentoId,
          personaIds: personasSelecionadas,
          objetivo,
          eventId: reuniaoId || null,
        }),
      })

      const dados = await resposta.json()

      if (!resposta.ok) {
        setErro(dados.error ?? 'Não foi possível gerar o Dry Run.')
        return
      }

      historico.adicionarVersao(dados.content, reuniaoId || null)

      if (dados.persisted === false) {
        setErro(
          'A análise foi gerada, mas não ficou salva no histórico. Copie o que precisar antes de sair da tela.'
        )
      }
    } catch {
      setErro('A conexão caiu no meio da geração. Tente de novo.')
    } finally {
      setGerando(false)
    }
  }

  function alternarPersona(id: string) {
    setPersonasSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((p) => p !== id) : [...atual, id]
    )
  }

  const resultado = historico.versaoAtual?.content
  const reuniaoAtual = reunioes.find((r) => r.id === reuniaoId)

  const escopoHistorico = reuniaoAtual
    ? `Versões desta reunião: ${reuniaoAtual.title}`
    : 'Versões avulsas, sem reunião vinculada'

  /* ---------------------------------------------------------------------- */
  /* Tela                                                                   */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-base font-semibold text-gray-900">Dry Run</h3>
        <p className="mt-1 text-sm text-gray-500">
          A IA lê sua proposta pelos olhos de quem vai recebê-la e antecipa as
          perguntas, as críticas e a pressão por desconto.
        </p>

        {documentos.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
            <p className="text-sm text-gray-600">
              Nenhum PDF nesta oportunidade ainda.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Envie a proposta ou apresentação em Cadastros › Documentos. Nesta
              versão o Dry Run lê apenas PDF — exporte antes de subir.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Material a analisar
              </label>
              <select
                value={documentoId}
                onChange={(e) => setDocumentoId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#185FA5] focus:outline-none"
              >
                <option value="">Selecione um PDF…</option>
                {documentos.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.file_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Reunião{' '}
                <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <select
                value={reuniaoId}
                onChange={(e) => aplicarReuniao(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#185FA5] focus:outline-none"
              >
                <option value="">Sem reunião vinculada</option>
                {reunioes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {dataCurta(r.occurred_at)} — {r.title}
                  </option>
                ))}
              </select>
              {reunioes.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  Registre reuniões na aba Eventos para vincular as análises a
                  elas.
                </p>
              )}
            </div>

            {personas.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Quem vai receber este material
                </label>
                <div className="flex flex-wrap gap-2">
                  {personas.map((persona) => {
                    const marcada = personasSelecionadas.includes(persona.id)
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => alternarPersona(persona.id)}
                        className={
                          marcada
                            ? 'rounded-full border border-[#185FA5] bg-blue-50 px-3 py-1 text-sm text-[#185FA5]'
                            : 'rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50'
                        }
                      >
                        {persona.rotulo}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Objetivo e contexto da reunião{' '}
                <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <textarea
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                rows={5}
                placeholder={
                  'O que você quer sair desta reunião, e o que já aconteceu antes dela.\n\nPode usar tópicos:\n- apresentar a Bosen como parceira ODM\n- entender se há demanda real de bodycam no portfólio'
                }
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-[#185FA5] focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-400">
                {reuniaoAtual
                  ? 'Trazido da reunião. Editar aqui não altera o evento.'
                  : 'Quanto mais específico, mais a análise fala da sua reunião e menos fala de vendas em geral.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={gerar}
                disabled={gerando || !documentoId}
                className="rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {gerando ? 'Analisando…' : 'Rodar Dry Run'}
              </button>
              {gerando && (
                <span className="text-sm text-gray-500">
                  A leitura completa leva até 45 segundos.
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      <MensagemErro texto={erro} />

      {historico.carregando ? (
        <p className="text-sm text-gray-400">Carregando histórico…</p>
      ) : resultado ? (
        <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <NavegacaoVersoes
            versoes={historico.versoes}
            indice={historico.indice}
            onMudar={historico.setIndice}
            escopo={escopoHistorico}
          />

          {resultado._meta?.documento_nome && (
            <p className="text-xs text-gray-500">
              Material analisado:{' '}
              <span className="font-medium text-gray-700">
                {resultado._meta.documento_nome}
              </span>
            </p>
          )}

          {resultado.resumo && (
            <p className="text-sm leading-relaxed text-gray-700">
              {resultado.resumo}
            </p>
          )}

          {!!resultado.ajustes_prioritarios?.length && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <TituloSecao>Faça isto antes da reunião</TituloSecao>
              <ol className="list-inside list-decimal space-y-1 text-sm text-gray-700">
                {resultado.ajustes_prioritarios.map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </div>
          )}

          {!!resultado.pontos_fracos?.length && (
            <div>
              <TituloSecao>Onde o material abre flanco</TituloSecao>
              <div className="space-y-3">
                {resultado.pontos_fracos.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 p-3 text-sm"
                  >
                    <p className="font-medium text-gray-900">{item.ponto}</p>
                    <p className="mt-1 text-gray-600">{item.por_que}</p>
                    <p className="mt-2 text-gray-700">
                      <span className="font-medium">Como reforçar: </span>
                      {item.como_reforcar}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!resultado.questionamentos_esperados?.length && (
            <div>
              <TituloSecao>Perguntas que você vai ouvir</TituloSecao>
              <div className="space-y-3">
                {resultado.questionamentos_esperados.map(
                  (item: any, i: number) => (
                    <div
                      key={i}
                      className="rounded-lg border border-gray-200 p-3 text-sm"
                    >
                      <p className="font-medium text-gray-900">
                        “{item.pergunta}”
                      </p>
                      {item.quem && (
                        <p className="mt-1 text-xs text-gray-500">
                          Provavelmente de {item.quem}
                        </p>
                      )}
                      <p className="mt-2 text-gray-700">
                        <span className="font-medium">Resposta: </span>
                        {item.resposta_sugerida}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {resultado.risco_desconto && (
            <div>
              <TituloSecao>Pressão por desconto</TituloSecao>
              <div className="rounded-lg border border-gray-200 p-3 text-sm">
                <span
                  className={
                    resultado.risco_desconto.probabilidade === 'alta'
                      ? 'rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700'
                      : resultado.risco_desconto.probabilidade === 'media'
                        ? 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700'
                        : 'rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700'
                  }
                >
                  risco {resultado.risco_desconto.probabilidade}
                </span>
                <p className="mt-2 text-gray-600">
                  {resultado.risco_desconto.justificativa}
                </p>
                <p className="mt-2 text-gray-700">
                  <span className="font-medium">Como defender: </span>
                  {resultado.risco_desconto.como_defender}
                </p>
              </div>
            </div>
          )}

          {!!resultado.pontos_fortes?.length && (
            <div>
              <TituloSecao>O que já está bom — enfatize</TituloSecao>
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                {resultado.pontos_fortes.map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {!!resultado.faltou_informacao?.length && (
            <div className="rounded-lg bg-gray-50 p-3">
              <TituloSecao>A análise melhoraria se você registrasse</TituloSecao>
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-500">
                {resultado.faltou_informacao.map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <AvisoIA />
        </section>
      ) : (
        <p className="text-sm text-gray-400">
          {reuniaoAtual
            ? `Nenhum Dry Run rodado para "${reuniaoAtual.title}" ainda.`
            : 'Nenhum Dry Run avulso rodado nesta oportunidade ainda.'}
        </p>
      )}
    </div>
  )
}