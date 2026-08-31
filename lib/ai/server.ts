/**
 * lib/ai/server.ts
 *
 * Funções compartilhadas pelas rotas de IA (Dry Run, Mocking Meeting e,
 * futuramente, Análise e Roteiro).
 *
 * Regra de ouro: este arquivo NUNCA roda no navegador. Ele vive apenas dentro
 * de API Routes, onde a ANTHROPIC_API_KEY existe. Não importe daqui em nenhum
 * componente com 'use client'.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

/** Modelo usado por todas as gerações. Trocar aqui muda em todas as features. */
export const MODEL = 'claude-sonnet-4-6'

/** Bucket do Supabase Storage onde os documentos ficam. */
export const BUCKET = 'documents'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

/* -------------------------------------------------------------------------- */
/* 1. Cliente Supabase com a identidade do usuário                            */
/* -------------------------------------------------------------------------- */

/**
 * Cria um cliente Supabase que carrega o token de sessão do usuário.
 *
 * Por que isso importa: o RLS do banco continua ativo. Se houver um bug nesta
 * rota, ela ainda assim não consegue ler dados de outra organização — a regra
 * está no Postgres, não neste código. Em nenhum momento usamos service role key.
 */
export function supabaseFromRequest(req: Request): SupabaseClient | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/* -------------------------------------------------------------------------- */
/* 2. Montagem do contexto da oportunidade                                     */
/* -------------------------------------------------------------------------- */

/**
 * Colunas que nunca entram no texto enviado ao modelo: são identificadores
 * técnicos, não informação de negócio.
 */
const COLUNAS_TECNICAS = new Set([
  'id',
  'organization_id',
  'opportunity_id',
  'persona_id',
  'user_id',
  'created_by',
  'owner_id',
  'file_path',
  'extracted_text',
  'created_at',
  'updated_at',
])

function rotular(chave: string): string {
  return chave.replace(/_/g, ' ')
}

/**
 * Converte uma linha do banco em texto legível, pulando colunas técnicas e
 * campos vazios.
 *
 * Escolha deliberada: lemos `select('*')` em vez de listar colunas. Quando você
 * adicionar um campo novo em `opportunities` ou `personas`, a IA passa a
 * enxergá-lo automaticamente, sem alterar nenhuma rota.
 */
function linhaParaTexto(linha: Record<string, any>): string {
  return Object.entries(linha)
    .filter(([chave, valor]) => {
      if (COLUNAS_TECNICAS.has(chave)) return false
      if (valor === null || valor === undefined || valor === '') return false
      if (Array.isArray(valor) && valor.length === 0) return false
      return true
    })
    .map(([chave, valor]) => {
      const texto =
        typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
      return `- ${rotular(chave)}: ${texto}`
    })
    .join('\n')
}

function nomeDaPersona(persona: Record<string, any>, indice: number): string {
  return (
    persona.name ??
    persona.nome ??
    persona.full_name ??
    persona.contact_name ??
    `Persona ${indice + 1}`
  )
}

/* -------------------------------------------------------------------------- */
/* 2b. Linha do tempo                                                          */
/* -------------------------------------------------------------------------- */

/** Quantos eventos entram no contexto. Ver decisão D10. */
export const LIMITE_EVENTOS = 15

const ROTULO_TIPO: Record<string, string> = {
  reuniao: 'Reunião',
  ligacao: 'Ligação',
  email: 'E-mail',
  mensagem: 'Mensagem',
  almoco: 'Almoço / encontro',
  noticia: 'Notícia',
  conversa_mercado: 'Conversa de mercado',
  outro: 'Outro',
}

function dataCurta(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/**
 * Formata um evento como bloco de texto.
 *
 * Reuniões trazem objetivo, participantes e feedback; os demais tipos trazem a
 * descrição. Campos vazios são omitidos — linha com rótulo e nada depois só
 * gasta contexto.
 */
function eventoParaTexto(
  evento: Record<string, any>,
  nomePorPersonaId: Map<string, string>
): string {
  const cabecalho = `### ${dataCurta(evento.occurred_at)} · ${ROTULO_TIPO[evento.type] ?? evento.type} — ${evento.title}`
  const linhas: string[] = []

  const participantes = (evento.event_personas ?? [])
    .map((ep: any) => nomePorPersonaId.get(ep.persona_id))
    .filter(Boolean)

  if (participantes.length > 0) {
    linhas.push(`- Participantes: ${participantes.join(', ')}`)
  }
  if (evento.objective) linhas.push(`- Objetivo: ${evento.objective}`)
  if (evento.description) linhas.push(`- ${evento.description}`)
  if (evento.feedback) {
    linhas.push(`- Feedback do vendedor depois da reunião: ${evento.feedback}`)
  }

  return [cabecalho, ...linhas].join('\n')
}

/* -------------------------------------------------------------------------- */
/* 2c. Contexto completo                                                       */
/* -------------------------------------------------------------------------- */

export type ContextoOportunidade = {
  oportunidade: Record<string, any>
  personas: Record<string, any>[]
  eventos: Record<string, any>[]
  texto: string
}

/**
 * Carrega a oportunidade, suas personas, a linha do tempo e o contexto de
 * produto da organização, e devolve tudo já formatado como texto.
 *
 * @param personaIdsSelecionadas quando informado, apenas essas personas entram
 *        no bloco de pessoas. Serve para o vendedor simular só quem estará na
 *        reunião. A linha do tempo continua completa: quem não vai à reunião
 *        ainda influencia o que aconteceu antes dela.
 */
export async function carregarContexto(
  supabase: SupabaseClient,
  opportunityId: string,
  personaIdsSelecionadas?: string[]
): Promise<ContextoOportunidade> {
  const { data: oportunidade, error: erroOpp } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', opportunityId)
    .single()

  if (erroOpp || !oportunidade) {
    throw new Error('Oportunidade não encontrada ou fora do seu acesso.')
  }

  // A política de SELECT em organizations é `id = auth_org_id()`, então esta
  // consulta devolve apenas a organização do usuário. Sem join, sem profiles.
  const { data: organizacao } = await supabase
    .from('organizations')
    .select('product_context')
    .maybeSingle()

  const { data: todasPersonas } = await supabase
    .from('personas')
    .select('*')
    .eq('opportunity_id', opportunityId)

  // Os mais recentes primeiro na consulta, para o LIMIT pegar os certos.
  const { data: eventosRecentes } = await supabase
    .from('events')
    .select('*, event_personas(persona_id)')
    .eq('opportunity_id', opportunityId)
    .order('occurred_at', { ascending: false })
    .limit(LIMITE_EVENTOS)

  const listaPersonas = todasPersonas ?? []
  const eventos = eventosRecentes ?? []

  // Mapa completo de nomes: os participantes de um evento podem incluir
  // personas que não foram selecionadas para a reunião atual.
  const nomePorPersonaId = new Map<string, string>(
    listaPersonas.map((p, i) => [p.id, nomeDaPersona(p, i)])
  )

  let personas = listaPersonas
  if (personaIdsSelecionadas && personaIdsSelecionadas.length > 0) {
    personas = personas.filter((p) => personaIdsSelecionadas.includes(p.id))
  }

  const blocoPersonas =
    personas.length === 0
      ? 'Nenhuma persona cadastrada para esta oportunidade.'
      : personas
          .map(
            (p, i) =>
              `### ${nomeDaPersona(p, i)}\n${linhaParaTexto(p)}`
          )
          .join('\n\n')

  // Ordem cronológica na leitura: a narrativa do deal fica clara do começo para
  // o fim, mesmo que a seleção tenha sido pelos mais recentes.
  const blocoEventos =
    eventos.length === 0
      ? 'Nenhum evento registrado. Não presuma histórico de relacionamento.'
      : [...eventos]
          .reverse()
          .map((e) => eventoParaTexto(e, nomePorPersonaId))
          .join('\n\n')

  const tituloEventos =
    eventos.length >= LIMITE_EVENTOS
      ? `## LINHA DO TEMPO (${LIMITE_EVENTOS} eventos mais recentes)`
      : `## LINHA DO TEMPO (${eventos.length})`

  // O portfólio vem primeiro: ele enquadra tudo o que vem depois. Sem saber o
  // que o vendedor vende, a IA infere a partir do material anexado — o que
  // funciona com um catálogo e falha com uma proposta comercial.
  const contextoProduto = (organizacao?.product_context ?? '').trim()
  const blocoProduto = contextoProduto
    ? `## O QUE O VENDEDOR VENDE\n${contextoProduto}`
    : '## O QUE O VENDEDOR VENDE\nNão informado. Infira a partir do material anexado e não afirme capacidades que o material não sustenta.'

  const texto = [
    blocoProduto,
    '',
    '## OPORTUNIDADE',
    linhaParaTexto(oportunidade),
    '',
    `## PESSOAS ENVOLVIDAS (${personas.length})`,
    blocoPersonas,
    '',
    tituloEventos,
    blocoEventos,
  ].join('\n')

  return { oportunidade, personas, eventos, texto }
}

/* -------------------------------------------------------------------------- */
/* 3. Leitura de documento do Storage                                          */
/* -------------------------------------------------------------------------- */

export const LIMITE_PDF_BYTES = 10 * 1024 * 1024 // 10 MB

export type DocumentoCarregado = {
  registro: Record<string, any>
  base64: string
}

/**
 * Baixa um PDF do Storage e devolve em base64, pronto para a API da Anthropic.
 *
 * No MVP só aceitamos PDF: o modelo lê o arquivo nativamente, enxergando
 * tabelas, layout e ênfase visual. DOCX e PPTX exigiriam extração de texto cru
 * — que joga fora justamente o que importa numa proposta comercial. Ficam para
 * a V2, e é aí que a coluna `extracted_text` da tabela `documents` entra.
 */
export async function carregarPdf(
  supabase: SupabaseClient,
  documentId: string
): Promise<DocumentoCarregado> {
  const { data: registro, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (error || !registro) {
    throw new Error('Documento não encontrado ou fora do seu acesso.')
  }

  const ehPdf =
    registro.mime_type === 'application/pdf' ||
    String(registro.file_name ?? '').toLowerCase().endsWith('.pdf')

  if (!ehPdf) {
    throw new Error(
      `"${registro.file_name}" não é um PDF. O Dry Run lê apenas PDF nesta versão — exporte o arquivo em PDF e faça o upload de novo na aba Documentos.`
    )
  }

  if (registro.file_size && registro.file_size > LIMITE_PDF_BYTES) {
    throw new Error(
      `"${registro.file_name}" tem ${(registro.file_size / 1024 / 1024).toFixed(1)} MB. O limite é 10 MB.`
    )
  }

  const { data: arquivo, error: erroDownload } = await supabase.storage
    .from(BUCKET)
    .download(registro.file_path)

  if (erroDownload || !arquivo) {
    throw new Error('Não foi possível baixar o arquivo do Storage.')
  }

  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64')
  return { registro, base64 }
}

/* -------------------------------------------------------------------------- */
/* 4. Chamada à Anthropic com resposta em JSON                                 */
/* -------------------------------------------------------------------------- */

/**
 * Extrai o JSON de uma resposta em texto.
 *
 * O modelo às vezes envolve a resposta em ```json ... ``` ou escreve uma frase
 * antes. Em vez de brigar com isso no prompt, recortamos do primeiro `{` até o
 * último `}` — mais robusto e sem custo.
 */
function extrairJson(texto: string): any {
  const limpo = texto.replace(/```json/gi, '').replace(/```/g, '').trim()
  const inicio = limpo.indexOf('{')
  const fim = limpo.lastIndexOf('}')
  if (inicio === -1 || fim === -1) {
    throw new Error('O modelo não devolveu JSON válido. Tente gerar de novo.')
  }
  return JSON.parse(limpo.slice(inicio, fim + 1))
}

export type BlocoConteudo =
  | { type: 'text'; text: string }
  | {
      type: 'document'
      source: { type: 'base64'; media_type: 'application/pdf'; data: string }
    }

/**
 * Chama o modelo e devolve o JSON já parseado.
 *
 * `max_tokens` em 4000 por decisão anterior: 2000 truncava o Roteiro.
 */
export async function gerarJson(
  system: string,
  blocos: BlocoConteudo[],
  maxTokens = 4000
): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY não encontrada. Confira o .env.local e reinicie o servidor.'
    )
  }

  const anthropic = new Anthropic({ apiKey })

  const resposta = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: blocos as any }],
  })

  const texto = resposta.content
    .filter((bloco: any) => bloco.type === 'text')
    .map((bloco: any) => bloco.text)
    .join('\n')

  if (resposta.stop_reason === 'max_tokens') {
    throw new Error(
      'A resposta foi cortada por limite de tamanho. Selecione menos personas ou um documento menor.'
    )
  }

  return extrairJson(texto)
}

/* -------------------------------------------------------------------------- */
/* 5. Persistência                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Grava o resultado em `ai_outputs`. Cada geração é uma linha nova — nunca um
 * update. É isso que torna o histórico de versões possível.
 *
 * Devolve `false` se a gravação falhar: nesse caso a rota ainda entrega o
 * conteúdo ao vendedor. Perder o histórico é ruim; perder a análise que acabou
 * de custar 40 segundos é pior.
 */
export async function salvarOutput(
  supabase: SupabaseClient,
  opportunityId: string,
  outputType: string,
  content: any
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_outputs')
    .insert({ opportunity_id: opportunityId, output_type: outputType, content })

  return !error
}