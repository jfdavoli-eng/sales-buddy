import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'claude-sonnet-4-6'

type OutputType = 'analise_qualitativa' | 'roteiro'

const SYSTEM_PROMPT = `Você é um consultor sênior de vendas B2B corporativas, com experiência em ciclos longos, múltiplos decisores e concorrência forte.

Você está assessorando um vendedor específico sobre uma oportunidade específica. Seu papel não é dar conselhos genéricos de vendas — é analisar ESTE deal, com ESTAS pessoas, e dizer o que ele deveria fazer a seguir.

Princípios:
- Seja concreto. "Envolver o financeiro" é vago; "pedir ao Roberto uma introdução ao CFO antes da proposta" é acionável.
- Use os nomes reais das pessoas e da empresa.
- A experiência pessoal que o vendedor registrou é a informação mais valiosa que você tem. Ela não está em nenhum CRM. Use-a.
- Quando o contexto for insuficiente para uma conclusão, diga isso em vez de inventar. Apontar uma lacuna de informação é uma entrega válida.
- Não elogie o vendedor nem suavize riscos. Ele precisa de leitura honesta, não de encorajamento.

Responda SEMPRE em português do Brasil e SEMPRE apenas com o JSON pedido, sem markdown, sem crases, sem texto antes ou depois.`

const SCHEMAS: Record<OutputType, string> = {
  analise_qualitativa: `{
  "resumo": "2 a 3 frases com a leitura geral do deal",
  "pontos_fortes": [{ "titulo": "curto", "detalhe": "1 a 2 frases" }],
  "riscos": [{ "titulo": "curto", "detalhe": "1 a 2 frases", "severidade": "alto" | "medio" | "baixo" }],
  "acoes": [{ "titulo": "curto e no imperativo", "detalhe": "1 a 2 frases", "prazo": "imediato" | "curto" | "medio" }],
  "lacunas": ["informação que falta para uma análise melhor"]
}

Entregue de 2 a 4 itens em pontos_fortes, riscos e acoes. Ordene riscos por severidade e acoes por urgência.`,

  roteiro: `{
  "resumo": "2 a 3 frases sobre o ângulo geral da abordagem",
  "abertura": "como iniciar a conversa, em 2 a 3 frases",
  "mensagens_chave": [{ "titulo": "curto", "detalhe": "o argumento e por que funciona com este cliente" }],
  "por_persona": [{ "persona": "nome", "angulo": "o que enfatizar com esta pessoa", "cuidado": "o que evitar" }],
  "perguntas": ["pergunta aberta para fazer na reunião"],
  "objecoes": [{ "objecao": "o que ele provavelmente vai dizer", "resposta": "como responder" }],
  "proximos_passos": ["ação concreta pós-reunião"]
}

Entregue exatamente 3 mensagens_chave, 3 perguntas e 3 objecoes. Inclua uma entrada em por_persona para cada persona cadastrada. Seja conciso: cada campo de texto em no máximo 2 frases.`,
}

function buildContext(opportunity: Record<string, unknown>, personas: Record<string, unknown>[], documents: { file_name: string }[], globalProducts: string | null) {
  const lines: string[] = []

  lines.push('## OPORTUNIDADE')
  for (const [key, value] of Object.entries(opportunity)) {
    if (value === null || value === '' || key === 'id' || key.endsWith('_id')) continue
    lines.push(`${key}: ${String(value)}`)
  }

  if (globalProducts && !opportunity.products_services) {
    lines.push(`products_services (padrão global do vendedor): ${globalProducts}`)
  }

  lines.push('')
  lines.push('## PESSOAS ENVOLVIDAS NA COMPRA')
  if (personas.length === 0) {
    lines.push('Nenhuma persona cadastrada. Isso é em si um risco relevante.')
  } else {
    personas.forEach((p, i) => {
      lines.push(`--- Persona ${i + 1} ---`)
      for (const [key, value] of Object.entries(p)) {
        if (value === null || value === '' || key === 'id' || key.endsWith('_id')) continue
        lines.push(`${key}: ${String(value)}`)
      }
    })
  }

  lines.push('')
  lines.push('## DOCUMENTOS ANEXADOS')
  lines.push(
    documents.length === 0
      ? 'Nenhum documento anexado.'
      : documents.map((d) => `- ${d.file_name}`).join('\n') +
          '\n(Você recebeu apenas os nomes dos arquivos, não o conteúdo.)'
  )

  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Sessão não encontrada. Faça login novamente.' }, { status: 401 })
  }

  let body: { opportunityId?: string; outputType?: OutputType }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }

  const { opportunityId, outputType } = body
  if (!opportunityId || !outputType || !(outputType in SCHEMAS)) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }

  // Cliente com o token do usuário: o RLS continua valendo.
  // Nenhuma service role key envolvida.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: opportunity, error: oppError } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', opportunityId)
    .single()

  if (oppError || !opportunity) {
    return NextResponse.json({ error: 'Oportunidade não encontrada.' }, { status: 404 })
  }

  const [{ data: personas }, { data: documents }, { data: auth }] = await Promise.all([
    supabase.from('personas').select('*').eq('opportunity_id', opportunityId),
    supabase.from('documents').select('file_name').eq('opportunity_id', opportunityId),
    supabase.auth.getUser(),
  ])

  let globalProducts: string | null = null
  if (auth?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('products_services')
      .eq('id', auth.user.id)
      .single()
    globalProducts = profile?.products_services ?? null
  }

  const context = buildContext(opportunity, personas ?? [], documents ?? [], globalProducts)

  const userPrompt = `Analise a oportunidade abaixo.

${context}

---

Responda apenas com um JSON neste formato:

${SCHEMAS[outputType as OutputType]}`

  const anthropic = new Anthropic({ apiKey })

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    raw = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: `Falha ao gerar: ${message}` }, { status: 502 })
  }

  // Rede de segurança: o modelo pode envolver o JSON em crases apesar da instrução.
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()

  let content: unknown
  try {
    content = JSON.parse(cleaned)
  } catch {
    return NextResponse.json(
      { error: 'A resposta da IA veio fora do formato esperado. Tente gerar novamente.' },
      { status: 502 }
    )
  }

  const { error: insertError } = await supabase
    .from('ai_outputs')
    .insert({ opportunity_id: opportunityId, output_type: outputType, content })

  if (insertError) {
    // A geração funcionou; só o histórico falhou. Devolve o conteúdo mesmo assim.
    return NextResponse.json({ content, persisted: false })
  }

  return NextResponse.json({ content, persisted: true })
}