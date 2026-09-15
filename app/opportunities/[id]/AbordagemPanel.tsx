'use client'

/**
 * app/opportunities/[id]/AbordagemPanel.tsx
 *
 * D3 — Abordagem e Próximos Passos. Substitui a Análise Qualitativa e o
 * Roteiro (InteligenciaTab.tsx), que viravam duas leituras sobrepostas.
 *
 * Mesma estrutura do Dry Run: reunião opcional, histórico de versões escopado
 * por reunião (useHistoricoIA) e uma única chamada à IA.
 */

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import {
  useHistoricoIA,
  NavegacaoVersoes,
  TituloSecao,
  AvisoIA,
  MensagemErro,
} from './AiHistory'

const OUTPUT_TYPE = 'abordagem'

type Reuniao = { id: string; title: string; occurred_at: string }

/* eslint-disable @typescript-eslint/no-explicit-any */

const SEVERIDADE: Record<string, string> = {
  alto: 'bg-red-50 text-red-700',
  medio: 'bg-amber-50 text-amber-700',
  baixo: 'bg-gray-100 text-gray-600',
}

const TEMPERATURA: Record<string, string> = {
  quente: 'bg-green-50 text-green-700',
  morna: 'bg-amber-50 text-amber-700',
  fria: 'bg-blue-50 text-blue-700',
}

const PRAZO: Record<string, string> = {
  imediato: 'Imediato',
  esta_semana: 'Esta semana',
  proximas_semanas: 'Próximas semanas',
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function AbordagemPanel({ opportunityId }: { opportunityId: string }) {
  const supabase = useMemo(() => createClient(), [])

  const [reunioes, setReunioes] = useState<Reuniao[]>([])
  const [reuniaoId, setReuniaoId] = useState('')
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')

  const historico = useHistoricoIA(opportunityId, OUTPUT_TYPE, reuniaoId || null)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, title, occurred_at')
      .eq('opportunity_id', opportunityId)
      .eq('type', 'reuniao')
      .order('occurred_at', { ascending: false })
      .then(({ data }) => setReunioes((data as Reuniao[]) ?? []))
  }, [supabase, opportunityId])

  async function gerar() {
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

      const resposta = await fetch('/api/abordagem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ opportunityId, eventId: reuniaoId || null }),
      })
      const dados = await resposta.json()

      if (!resposta.ok) {
        setErro(dados.error ?? 'Não foi possível gerar a abordagem.')
        return
      }

      historico.adicionarVersao(dados.content, reuniaoId || null)

      if (dados.persisted === false) {
        setErro(
          'A abordagem foi gerada, mas não ficou salva no histórico. Copie o que precisar antes de sair da tela.'
        )
      }
    } catch {
      setErro('A conexão caiu no meio da geração. Tente de novo.')
    } finally {
      setGerando(false)
    }
  }

  const r: any = historico.versaoAtual?.content
  const reuniaoAtual = reunioes.find((x) => x.id === reuniaoId)
  const escopo = reuniaoAtual
    ? `Versões desta reunião: ${reuniaoAtual.title}`
    : 'Versões gerais do deal, sem reunião vinculada'

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-base font-semibold text-gray-900">Abordagem e Próximos Passos</h3>
        <p className="mt-1 text-sm text-gray-500">
          Onde o deal realmente está, como tratar cada pessoa e o que fazer agora.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Reunião <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <select
              value={reuniaoId}
              onChange={(e) => {
                setReuniaoId(e.target.value)
                setErro('')
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#185FA5] focus:outline-none"
            >
              <option value="">Leitura geral do deal</option>
              {reunioes.map((x) => (
                <option key={x.id} value={x.id}>
                  {dataCurta(x.occurred_at)} — {x.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              {reuniaoAtual
                ? 'A abordagem será preparada para esta conversa e seus participantes.'
                : 'Com uma reunião escolhida, abertura, perguntas e objeções focam nela.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={gerar}
              disabled={gerando}
              className="rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {gerando ? 'Gerando…' : r ? 'Gerar nova versão' : 'Gerar abordagem'}
            </button>
            {gerando && (
              <span className="text-sm text-gray-500">Leva até 45 segundos.</span>
            )}
          </div>
        </div>
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
            escopo={escopo}
          />

          {r.leitura_do_deal && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <TituloSecao>Leitura do deal</TituloSecao>
                {r.temperatura && (
                  <span
                    className={`-mt-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                      TEMPERATURA[r.temperatura] ?? TEMPERATURA.morna
                    }`}
                  >
                    {r.temperatura}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-gray-700">{r.leitura_do_deal}</p>
            </div>
          )}

          {!!r.proximos_passos?.length && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <TituloSecao>Próximos passos</TituloSecao>
              <ol className="space-y-2 text-sm text-gray-700">
                {r.proximos_passos.map((p: any, i: number) => {
                  // Versões antigas usavam "responsavel", quase sempre "Vendedor".
                  const comQuem = String(p.com_quem ?? p.responsavel ?? '').trim()
                  const parte = /^vendedor$/i.test(comQuem) ? '' : comQuem
                  return (
                  <li key={i} className="flex gap-2">
                    <span className="font-semibold text-gray-500">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{p.acao}</span>
                        {p.prazo && (
                          <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#0C447C]">
                            {PRAZO[p.prazo] ?? p.prazo}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {parte && <>Com: {parte}</>}
                        {parte && p.sinal_de_sucesso && ' · '}
                        {p.sinal_de_sucesso && <>Funcionou se: {p.sinal_de_sucesso}</>}
                      </p>
                    </div>
                  </li>
                  )
                })}
              </ol>
            </div>
          )}

          {!!r.riscos?.length && (
            <div>
              <TituloSecao>Riscos</TituloSecao>
              <div className="space-y-2">
                {r.riscos.map((x: any, i: number) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-gray-900">{x.titulo}</p>
                      {x.severidade && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            SEVERIDADE[x.severidade] ?? SEVERIDADE.baixo
                          }`}
                        >
                          {x.severidade}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-gray-600">{x.detalhe}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.abertura && (
            <div>
              <TituloSecao>Abertura</TituloSecao>
              <p className="rounded-lg bg-[#E6F1FB] px-4 py-3 text-sm text-[#0C447C]">{r.abertura}</p>
            </div>
          )}

          {!!r.abordagem_por_persona?.length && (
            <div>
              <TituloSecao>Como tratar cada pessoa</TituloSecao>
              <div className="space-y-2">
                {r.abordagem_por_persona.map((p: any, i: number) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <p className="font-medium text-gray-900">
                      {p.persona}
                      {p.papel && <span className="font-normal text-gray-500"> · {p.papel}</span>}
                    </p>
                    <p className="mt-1 text-gray-600">
                      <span className="font-medium text-gray-700">Enfatizar: </span>
                      {p.angulo}
                    </p>
                    <p className="mt-1 text-gray-600">
                      <span className="font-medium text-gray-700">Evitar: </span>
                      {p.evitar}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!r.perguntas?.length && (
            <div>
              <TituloSecao>Perguntas para fazer</TituloSecao>
              <div className="space-y-2">
                {r.perguntas.map((p: any, i: number) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <p className="font-medium text-gray-900">“{p.pergunta}”</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {p.para && <>Para {p.para}</>}
                      {p.para && p.objetivo && ' · '}
                      {p.objetivo}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!r.objecoes?.length && (
            <div>
              <TituloSecao>Objeções prováveis</TituloSecao>
              <div className="space-y-2">
                {r.objecoes.map((o: any, i: number) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <p className="font-medium text-gray-900">“{o.objecao}”</p>
                    {o.quem && <p className="mt-1 text-xs text-gray-500">Provavelmente de {o.quem}</p>}
                    <p className="mt-2 text-gray-700">
                      <span className="font-medium">Resposta: </span>
                      {o.resposta}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!r.lacunas?.length && (
            <div className="rounded-lg bg-gray-50 p-3">
              <TituloSecao>A leitura melhoraria se você registrasse</TituloSecao>
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-500">
                {r.lacunas.map((item: string, i: number) => (
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
            ? `Nenhuma abordagem gerada para "${reuniaoAtual.title}" ainda.`
            : 'Nenhuma leitura geral gerada nesta oportunidade ainda.'}
        </p>
      )}
    </div>
  )
}
