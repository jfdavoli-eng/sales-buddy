'use client'

/**
 * app/opportunities/[id]/MockingMeetingPanel.tsx
 *
 * Mocking Meeting: a IA simula a reunião antes dela acontecer.
 *
 * O material é opcional — quem analisa deck é o Dry Run. O que não pode faltar
 * é gente e contexto. Como a qualidade da simulação depende inteiramente do
 * setup, o painel mostra o que está registrado e o que falta ANTES de gerar:
 * quem vê que o resultado melhoraria com mais duas informações tende a
 * preenchê-las.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import NovaPersonaRapida from './NovaPersonaRapida'
import {
  useHistoricoIA,
  NavegacaoVersoes,
  TituloSecao,
  AvisoIA,
  MensagemErro,
} from './AiHistory'

const OUTPUT_TYPE = 'mocking'

type Documento = { id: string; file_name: string; mime_type: string | null }
type Persona = { id: string; rotulo: string; temPerfil: boolean }
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

/**
 * Uma persona "tem perfil" quando há mais nela do que o nome. Serve para o
 * indicador de prontidão: simular alguém de quem só se sabe o nome produz
 * caricatura, não simulação.
 */
function temPerfil(p: any): boolean {
  // Só cargo e experiência pessoal contam. O perfil de influência sempre vem
  // preenchido (padrão "neutro"), então contá-lo tornava o alerta inútil.
  return Boolean(
    String(p.job_title ?? '').trim() || String(p.personal_experience ?? '').trim()
  )
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function MockingMeetingPanel({
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
  const [totalEventos, setTotalEventos] = useState(0)

  const [reuniaoId, setReuniaoId] = useState(eventoInicialId ?? '')
  const [documentoId, setDocumentoId] = useState('')
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const [objetivo, setObjetivo] = useState('')
  const [desafio, setDesafio] = useState('')

  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  const historico = useHistoricoIA(opportunityId, OUTPUT_TYPE, reuniaoId || null)

  /* ---------------------------------------------------------------------- */
  /* Carregamento                                                           */
  /* ---------------------------------------------------------------------- */

  const carregarInsumos = useCallback(async () => {
    setCarregando(true)

    const [docs, pers, evs, todos] = await Promise.all([
      supabase
        .from('documents')
        .select('id, file_name, mime_type')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false }),
      supabase.from('personas').select('*').eq('opportunity_id', opportunityId),
      supabase
        .from('events')
        .select('id, title, occurred_at, objective, event_personas(persona_id)')
        .eq('opportunity_id', opportunityId)
        .eq('type', 'reuniao')
        .order('occurred_at', { ascending: false }),
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('opportunity_id', opportunityId),
    ])

    const lista: Persona[] = (pers.data ?? []).map((p: any, i: number) => ({
      id: p.id,
      rotulo: rotularPersona(p, i),
      temPerfil: temPerfil(p),
    }))

    setDocumentos(
      (docs.data ?? []).filter(
        (d: Documento) =>
          d.mime_type === 'application/pdf' ||
          d.file_name?.toLowerCase().endsWith('.pdf')
      )
    )
    setPersonas(lista)
    setReunioes((evs.data as any) ?? [])
    setTotalEventos(todos.count ?? 0)
    setCarregando(false)

    if (!reuniaoId) setSelecionadas(lista.map((p) => p.id))
  }, [supabase, opportunityId, reuniaoId])

  useEffect(() => {
    carregarInsumos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId])

  const aplicarReuniao = useCallback(
    (id: string) => {
      setReuniaoId(id)
      setErro('')

      if (!id) {
        setObjetivo('')
        setSelecionadas(personas.map((p) => p.id))
        return
      }

      const r = reunioes.find((x) => x.id === id)
      if (!r) return

      setObjetivo(r.objective ?? '')
      const participantes = (r.event_personas ?? []).map((ep) => ep.persona_id)
      setSelecionadas(
        participantes.length > 0 ? participantes : personas.map((p) => p.id)
      )
    },
    [personas, reunioes]
  )

  useEffect(() => {
    if (eventoInicialId && !carregando && reunioes.length > 0) {
      aplicarReuniao(eventoInicialId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoInicialId, carregando, reunioes.length])

  /* ---------------------------------------------------------------------- */
  /* Prontidão do setup                                                     */
  /* ---------------------------------------------------------------------- */

  const marcadas = personas.filter((p) => selecionadas.includes(p.id))
  const semPerfil = marcadas.filter((p) => !p.temPerfil)

  const checagens = [
    {
      ok: marcadas.length >= 2,
      bom: `${marcadas.length} pessoas na sala`,
      falta:
        marcadas.length === 1
          ? 'Só uma pessoa selecionada — sem duas, não há dinâmica para simular'
          : 'Nenhuma pessoa selecionada',
    },
    {
      ok: semPerfil.length === 0,
      bom: 'Todas as personas têm perfil registrado',
      falta: `Sem perfil: ${semPerfil.map((p) => p.rotulo).join(', ')} — simular quem só tem nome vira caricatura`,
    },
    {
      ok: totalEventos > 0,
      bom: `${totalEventos} eventos na linha do tempo`,
      falta: 'Nenhum evento registrado — a IA não sabe como o deal chegou até aqui',
    },
    {
      ok: objetivo.trim().length > 20,
      bom: 'Objetivo da reunião descrito',
      falta: 'Objetivo vazio ou muito curto',
    },
  ]

  const pendencias = checagens.filter((c) => !c.ok)

  /* ---------------------------------------------------------------------- */
  /* Geração                                                                */
  /* ---------------------------------------------------------------------- */

  async function gerar() {
    if (selecionadas.length === 0) {
      setErro('Escolha ao menos uma persona.')
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

      const resposta = await fetch('/api/mocking-meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          opportunityId,
          personaIds: selecionadas,
          documentId: documentoId || null,
          objetivo,
          desafio,
          eventId: reuniaoId || null,
        }),
      })

      const dados = await resposta.json()

      if (!resposta.ok) {
        setErro(dados.error ?? 'Não foi possível simular a reunião.')
        return
      }

      historico.adicionarVersao(dados.content, reuniaoId || null)

      if (dados.persisted === false) {
        setErro(
          'A simulação foi gerada, mas não ficou salva no histórico. Copie o que precisar antes de sair da tela.'
        )
      }
    } catch {
      setErro('A conexão caiu no meio da geração. Tente de novo.')
    } finally {
      setGerando(false)
    }
  }

  /** D8: persona criada aqui entra na lista já marcada. */
  function personaCriada(p: any) {
    setPersonas((atual) => [
      ...atual,
      { id: p.id, rotulo: rotularPersona(p, atual.length), temPerfil: temPerfil(p) },
    ])
    setSelecionadas((atual) => [...atual, p.id])
  }

  function alternar(id: string) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((p) => p !== id) : [...atual, id]
    )
  }

  const r = historico.versaoAtual?.content
  const reuniaoAtual = reunioes.find((x) => x.id === reuniaoId)

  if (carregando) {
    return <p className="text-sm text-gray-400">Carregando…</p>
  }

  /* ---------------------------------------------------------------------- */
  /* Tela                                                                   */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-base font-semibold text-gray-900">Mocking Meeting</h3>
        <p className="mt-1 text-sm text-gray-500">
          A IA simula como cada pessoa vai se comportar na reunião e como a sala
          funciona quando elas estão juntas.
        </p>

        {personas.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
            <p className="text-sm text-gray-600">
              Nenhuma persona cadastrada nesta oportunidade.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Sem gente na sala não há reunião para simular. Cadastre agora:
            </p>
            <div className="mt-3 flex justify-center">
              <NovaPersonaRapida
                opportunityId={opportunityId}
                onCriada={personaCriada}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
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
                {reunioes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {dataCurta(x.occurred_at)} — {x.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Quem estará na sala
              </label>
              <div className="flex flex-wrap gap-2">
                {personas.map((p) => {
                  const marcada = selecionadas.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => alternar(p.id)}
                      className={
                        marcada
                          ? 'rounded-full border border-[#185FA5] bg-blue-50 px-3 py-1 text-sm text-[#185FA5]'
                          : 'rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50'
                      }
                    >
                      {p.rotulo}
                      {!p.temPerfil && (
                        <span className="ml-1 text-xs text-amber-600">•</span>
                      )}
                    </button>
                  )
                })}
                <NovaPersonaRapida
                  opportunityId={opportunityId}
                  onCriada={personaCriada}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Objetivo e contexto da reunião
              </label>
              <textarea
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                rows={4}
                placeholder={
                  'O que você quer sair desta reunião, e onde o deal está agora.'
                }
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-[#185FA5] focus:outline-none"
              />
              {reuniaoAtual && (
                <p className="mt-1 text-xs text-gray-400">
                  Trazido da reunião. Editar aqui não altera o evento.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                O que te preocupa nesta reunião{' '}
                <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <textarea
                value={desafio}
                onChange={(e) => setDesafio(e.target.value)}
                rows={3}
                placeholder="Ex.: acho que vão comparar com a Hikvision e não tenho caso brasileiro para mostrar."
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-[#185FA5] focus:outline-none"
              />
            </div>

            {documentos.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Material que será apresentado{' '}
                  <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <select
                  value={documentoId}
                  onChange={(e) => setDocumentoId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#185FA5] focus:outline-none"
                >
                  <option value="">Reunião sem material</option>
                  {documentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.file_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Prontidão: mostra o que falta antes de gerar. */}
            {pendencias.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  A simulação ficaria melhor com
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-amber-900">
                  {pendencias.map((c, i) => (
                    <li key={i}>{c.falta}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-700">
                  Dá para gerar assim mesmo — só sabendo o que a IA não vai ter.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={gerar}
                disabled={gerando || selecionadas.length === 0}
                className="rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {gerando ? 'Simulando…' : 'Simular reunião'}
              </button>
              {gerando && (
                <span className="text-sm text-gray-500">
                  Leva até 45 segundos.
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      <MensagemErro texto={erro} />

      {historico.carregando ? (
        <p className="text-sm text-gray-400">Carregando histórico…</p>
      ) : r ? (
        <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <NavegacaoVersoes
            versoes={historico.versoes}
            indice={historico.indice}
            onMudar={historico.setIndice}
            escopo={
              reuniaoAtual
                ? `Versões desta reunião: ${reuniaoAtual.title}`
                : 'Versões avulsas, sem reunião vinculada'
            }
          />

          {r.leitura_da_sala && (
            <p className="text-sm leading-relaxed text-gray-700">
              {r.leitura_da_sala}
            </p>
          )}

          {r.abertura_sugerida && (
            <div className="rounded-lg border border-[#185FA5] bg-blue-50 p-4">
              <TituloSecao>Como abrir</TituloSecao>
              <p className="text-sm italic leading-relaxed text-gray-700">
                “{r.abertura_sugerida}”
              </p>
            </div>
          )}

          {!!r.personas?.length && (
            <div>
              <TituloSecao>Pessoa a pessoa</TituloSecao>
              <div className="space-y-4">
                {r.personas.map((p: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 p-3 text-sm"
                  >
                    <p className="font-semibold text-gray-900">{p.nome}</p>
                    {p.postura && (
                      <p className="mt-0.5 text-gray-600">{p.postura}</p>
                    )}

                    {p.voz && (
                      <p className="mt-2 text-xs italic text-gray-500">
                        {p.voz}
                      </p>
                    )}

                    {p.o_que_busca && (
                      <p className="mt-2 text-gray-700">
                        <span className="font-medium">Quer: </span>
                        {p.o_que_busca}
                      </p>
                    )}

                    {!!p.objecoes?.length && (
                      <div className="mt-3 space-y-2">
                        {p.objecoes.map((o: any, j: number) => (
                          <div
                            key={j}
                            className="rounded-md bg-gray-50 p-2.5"
                          >
                            <p className="font-medium text-gray-900">
                              “{o.fala}”
                            </p>
                            {o.por_tras && (
                              <p className="mt-1 text-xs text-gray-500">
                                Por trás: {o.por_tras}
                              </p>
                            )}
                            <p className="mt-1.5 text-gray-700">
                              <span className="font-medium">Resposta: </span>
                              {o.resposta}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {p.sinais && (
                      <p className="mt-2 text-xs text-gray-500">
                        <span className="font-medium">Observe: </span>
                        {p.sinais}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!r.dinamica?.length && (
            <div>
              <TituloSecao>A dinâmica da sala</TituloSecao>
              <div className="space-y-3">
                {r.dinamica.map((d: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-lg border-l-2 border-[#185FA5] bg-gray-50 p-3 text-sm"
                  >
                    {d.momento && (
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        {d.momento}
                      </p>
                    )}
                    <p className="mt-1 text-gray-700">{d.o_que_acontece}</p>
                    {d.como_conduzir && (
                      <p className="mt-2 text-gray-900">
                        <span className="font-medium">Conduza: </span>
                        {d.como_conduzir}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.risco_de_descarrilamento && (
            <div>
              <TituloSecao>O que pode derrubar a reunião</TituloSecao>
              <div className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="text-gray-900">
                  {r.risco_de_descarrilamento.gatilho}
                </p>
                <p className="mt-2 text-gray-700">
                  <span className="font-medium">Como evitar: </span>
                  {r.risco_de_descarrilamento.como_evitar}
                </p>
              </div>
            </div>
          )}

          {!!r.faltou_informacao?.length && (
            <div className="rounded-lg bg-gray-50 p-3">
              <TituloSecao>A simulação melhoraria se você registrasse</TituloSecao>
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-500">
                {r.faltou_informacao.map((item: string, i: number) => (
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
            ? `Nenhuma simulação para "${reuniaoAtual.title}" ainda.`
            : 'Nenhuma simulação avulsa nesta oportunidade ainda.'}
        </p>
      )}
    </div>
  )
}