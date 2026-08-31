'use client'

/**
 * app/opportunities/[id]/EventosTab.tsx
 *
 * Linha do tempo do deal. Registra o que aconteceu: reuniões, ligações,
 * e-mails, almoços, notícias, conversas de mercado.
 *
 * O princípio de desenho é o do estacionamento: o vendedor registra no celular,
 * logo depois do que aconteceu, com pressa. Por isso o formulário exige apenas
 * tipo, título e data — todo o resto é opcional. A qualidade vem do texto livre,
 * não da estrutura.
 *
 * Reuniões ganham três campos extras: objetivo, participantes e feedback. O
 * feedback é o olhar do vendedor depois; desdobramentos posteriores viram
 * eventos novos.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

/* -------------------------------------------------------------------------- */
/* Tipos de evento — a lista vive aqui, não no banco                          */
/* -------------------------------------------------------------------------- */

const TIPOS = [
  { valor: 'reuniao', rotulo: 'Reunião' },
  { valor: 'ligacao', rotulo: 'Ligação' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'mensagem', rotulo: 'Mensagem' },
  { valor: 'almoco', rotulo: 'Almoço / encontro' },
  { valor: 'noticia', rotulo: 'Notícia' },
  { valor: 'conversa_mercado', rotulo: 'Conversa de mercado' },
  { valor: 'outro', rotulo: 'Outro' },
] as const

function rotuloDoTipo(valor: string): string {
  return TIPOS.find((t) => t.valor === valor)?.rotulo ?? valor
}

/* -------------------------------------------------------------------------- */
/* Datas                                                                       */
/* -------------------------------------------------------------------------- */

/** ISO do banco -> valor aceito por <input type="datetime-local">. */
function paraInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatarQuando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ehPassado(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

/* -------------------------------------------------------------------------- */
/* Estilos compartilhados                                                      */
/* -------------------------------------------------------------------------- */

const inputClasse =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-[13px] focus:border-[#185FA5] focus:outline-none'

const FORM_VAZIO = {
  type: 'reuniao',
  title: '',
  occurred_at: '',
  description: '',
  objective: '',
  feedback: '',
}

type Persona = { id: string; rotulo: string }

function rotularPersona(p: any, i: number): string {
  return p.name ?? p.nome ?? p.full_name ?? p.contact_name ?? `Persona ${i + 1}`
}

/* -------------------------------------------------------------------------- */
/* Componente                                                                  */
/* -------------------------------------------------------------------------- */

export default function EventosTab({
  opportunityId,
}: {
  opportunityId: string
}) {
  const supabase = useMemo(() => createClient(), [])

  const [eventos, setEventos] = useState<any[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>(FORM_VAZIO)
  const [participantes, setParticipantes] = useState<string[]>([])

  /* ---------------------------------------------------------------------- */
  /* Carregamento                                                           */
  /* ---------------------------------------------------------------------- */

  const carregar = useCallback(async () => {
    setCarregando(true)

    const [ev, pers] = await Promise.all([
      supabase
        .from('events')
        .select('*, event_personas(persona_id)')
        .eq('opportunity_id', opportunityId)
        .order('occurred_at', { ascending: false }),
      supabase.from('personas').select('*').eq('opportunity_id', opportunityId),
    ])

    if (ev.error) setErro(ev.error.message)

    setEventos(ev.data ?? [])
    setPersonas(
      (pers.data ?? []).map((p: any, i: number) => ({
        id: p.id,
        rotulo: rotularPersona(p, i),
      }))
    )
    setCarregando(false)
  }, [supabase, opportunityId])

  useEffect(() => {
    carregar()
  }, [carregar])

  /* ---------------------------------------------------------------------- */
  /* Abertura do formulário                                                 */
  /* ---------------------------------------------------------------------- */

  function abrirNovo() {
    setForm({ ...FORM_VAZIO, occurred_at: paraInput(new Date().toISOString()) })
    setParticipantes([])
    setEditandoId(null)
    setCriando(true)
    setErro('')
  }

  function abrirEdicao(evento: any) {
    setForm({
      type: evento.type,
      title: evento.title ?? '',
      occurred_at: paraInput(evento.occurred_at),
      description: evento.description ?? '',
      objective: evento.objective ?? '',
      feedback: evento.feedback ?? '',
    })
    setParticipantes(
      (evento.event_personas ?? []).map((ep: any) => ep.persona_id)
    )
    setCriando(false)
    setEditandoId(evento.id)
    setErro('')
  }

  function fechar() {
    setCriando(false)
    setEditandoId(null)
    setErro('')
  }

  /* ---------------------------------------------------------------------- */
  /* Gravação                                                               */
  /* ---------------------------------------------------------------------- */

  async function salvar() {
    if (!form.title.trim()) {
      setErro('O evento precisa de um título.')
      return
    }
    if (!form.occurred_at) {
      setErro('Informe quando o evento aconteceu.')
      return
    }

    setSalvando(true)
    setErro('')

    const ehReuniao = form.type === 'reuniao'

    const registro: any = {
      opportunity_id: opportunityId,
      type: form.type,
      title: form.title.trim(),
      occurred_at: new Date(form.occurred_at).toISOString(),
      // Cada tipo grava só os campos que exibe. Trocar o tipo depois de
      // preencher não deve deixar dado órfão num evento que não o mostra.
      description: ehReuniao ? null : form.description.trim() || null,
      objective: ehReuniao ? form.objective.trim() || null : null,
      feedback: ehReuniao ? form.feedback.trim() || null : null,
      updated_at: new Date().toISOString(),
    }

    let eventoId = editandoId

    if (editandoId) {
      const { data, error } = await supabase
        .from('events')
        .update(registro)
        .eq('id', editandoId)
        .select()

      if (error) {
        setSalvando(false)
        setErro(error.message)
        return
      }
      if (!data || data.length === 0) {
        setSalvando(false)
        setErro('A gravação não afetou nenhuma linha. Verifique a política de UPDATE em events.')
        return
      }
    } else {
      const { data, error } = await supabase
        .from('events')
        .insert(registro)
        .select()

      if (error || !data || data.length === 0) {
        setSalvando(false)
        setErro(error?.message ?? 'Não foi possível criar o evento.')
        return
      }
      eventoId = data[0].id
    }

    // Participantes: apaga e reinsere. Com no máximo uma dezena de personas por
    // reunião, o diff incremental custaria mais código do que economiza.
    if (eventoId) {
      await supabase.from('event_personas').delete().eq('event_id', eventoId)

      if (ehReuniao && participantes.length > 0) {
        const { error: erroPers } = await supabase
          .from('event_personas')
          .insert(
            participantes.map((persona_id) => ({
              event_id: eventoId,
              persona_id,
            }))
          )
        if (erroPers) {
          setSalvando(false)
          setErro(`Evento salvo, mas os participantes não: ${erroPers.message}`)
          await carregar()
          return
        }
      }
    }

    setSalvando(false)
    fechar()
    await carregar()
  }

  async function apagar(id: string) {
    if (!confirm('Apagar este evento? As análises vinculadas a ele são mantidas.')) {
      return
    }
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    await carregar()
  }

  function alternarParticipante(id: string) {
    setParticipantes((atual) =>
      atual.includes(id) ? atual.filter((p) => p !== id) : [...atual, id]
    )
  }

  /* ---------------------------------------------------------------------- */
  /* Formulário                                                             */
  /* ---------------------------------------------------------------------- */

  const ehReuniao = form.type === 'reuniao'

  /**
   * Repare que isto é chamado como função — `{formulario()}` — e não renderizado
   * como `<Formulario />`. A diferença é decisiva: declarado dentro do
   * componente, `<Formulario />` seria um tipo novo a cada render, e o React
   * desmontaria e remontaria o formulário a cada tecla, fazendo o campo perder
   * o foco depois da primeira letra.
   */
  function formulario() {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className={inputClasse}
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Quando</label>
            <input
              type="datetime-local"
              value={form.occurred_at}
              onChange={(e) =>
                setForm({ ...form, occurred_at: e.target.value })
              }
              className={inputClasse}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Título</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex.: Discovery com o Bruno sobre bodycam"
            className={inputClasse}
          />
        </div>

        {ehReuniao && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Objetivo da reunião
              </label>
              <textarea
                value={form.objective}
                onChange={(e) =>
                  setForm({ ...form, objective: e.target.value })
                }
                rows={3}
                placeholder="O que você quer sair desta reunião."
                className={`${inputClasse} resize-y leading-relaxed`}
              />
            </div>

            {personas.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Participantes
                </label>
                <div className="flex flex-wrap gap-2">
                  {personas.map((p) => {
                    const marcada = participantes.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => alternarParticipante(p.id)}
                        className={
                          marcada
                            ? 'rounded-full border border-[#185FA5] bg-blue-50 px-3 py-1 text-xs text-[#185FA5]'
                            : 'rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50'
                        }
                      >
                        {p.rotulo}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Reunião tem antes (objetivo) e depois (feedback) — um relato no meio
            seria a mesma coisa com outro nome. Nos demais tipos, este é o único
            lugar onde o conteúdo mora. */}
        {!ehReuniao && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              O que aconteceu
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={4}
              placeholder="Escreva solto. É aqui que mora a informação que a IA não teria de outro jeito."
              className={`${inputClasse} resize-y leading-relaxed`}
            />
          </div>
        )}

        {ehReuniao && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Feedback depois da reunião
            </label>
            <textarea
              value={form.feedback}
              onChange={(e) => setForm({ ...form, feedback: e.target.value })}
              rows={4}
              placeholder="Como foi de verdade: o que travou, o que surpreendeu, qual o próximo passo acordado."
              className={`${inputClasse} resize-y leading-relaxed`}
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Pode voltar e preencher depois. É o campo que mais melhora as
              próximas análises.
            </p>
          </div>
        )}

        {erro && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
            {erro}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="px-3 py-1.5 bg-[#185FA5] text-white rounded-md text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={fechar}
            disabled={salvando}
            className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          {editandoId && (
            <button
              type="button"
              onClick={() => apagar(editandoId)}
              disabled={salvando}
              className="ml-auto px-3 py-1.5 border border-red-200 text-red-700 rounded-md text-xs font-medium hover:bg-red-50 disabled:opacity-50"
            >
              Apagar
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------------- */
  /* Tela                                                                   */
  /* ---------------------------------------------------------------------- */

  if (carregando) {
    return <p className="text-[13px] text-gray-400">Carregando eventos…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          Linha do tempo
        </p>
        {!criando && !editandoId && (
          <button
            type="button"
            onClick={abrirNovo}
            className="px-3 py-1.5 bg-[#185FA5] text-white rounded-md text-xs font-medium hover:opacity-90"
          >
            Registrar evento
          </button>
        )}
      </div>

      {criando && formulario()}

      {eventos.length === 0 && !criando && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
          <p className="text-[13px] text-gray-600">Nenhum evento registrado.</p>
          <p className="mx-auto mt-1 max-w-sm text-[11px] text-gray-500">
            Uma ligação, um almoço, uma notícia sobre o cliente. O que a IA sabe
            deste deal depende do que você registra aqui.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {eventos.map((evento) => {
          if (editandoId === evento.id) {
            return <div key={evento.id}>{formulario()}</div>
          }

          const reuniao = evento.type === 'reuniao'
          const faltaFeedback =
            reuniao && !evento.feedback && ehPassado(evento.occurred_at)
          const nomes = (evento.event_personas ?? [])
            .map(
              (ep: any) =>
                personas.find((p) => p.id === ep.persona_id)?.rotulo
            )
            .filter(Boolean)

          return (
            <div
              key={evento.id}
              className="bg-white border border-gray-200 rounded-xl p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={
                        reuniao
                          ? 'text-[9px] font-semibold text-[#185FA5] bg-blue-50 px-1.5 py-0.5 rounded-full'
                          : 'text-[9px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full'
                      }
                    >
                      {rotuloDoTipo(evento.type)}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {formatarQuando(evento.occurred_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] font-medium text-gray-900">
                    {evento.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => abrirEdicao(evento)}
                  className="shrink-0 px-2.5 py-1 border border-gray-300 text-gray-600 rounded-md text-[11px] font-medium hover:bg-gray-50"
                >
                  Editar
                </button>
              </div>

              {nomes.length > 0 && (
                <p className="mt-2 text-[11px] text-gray-500">
                  Participantes: {nomes.join(', ')}
                </p>
              )}

              {evento.description && (
                <p className="mt-2 text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {evento.description}
                </p>
              )}

              {evento.feedback && (
                <div className="mt-2 rounded-lg bg-gray-50 p-2.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Feedback
                  </p>
                  <p className="mt-1 text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {evento.feedback}
                  </p>
                </div>
              )}

              {faltaFeedback && (
                <button
                  type="button"
                  onClick={() => abrirEdicao(evento)}
                  className="mt-2 text-[11px] font-medium text-[#185FA5] hover:underline"
                >
                  Esta reunião já aconteceu — registrar o feedback
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}