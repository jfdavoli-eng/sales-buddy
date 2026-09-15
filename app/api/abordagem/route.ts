/**
 * app/api/abordagem/route.ts
 *
 * D3 — Abordagem e Próximos Passos.
 *
 * Substitui a Análise Qualitativa (B2) e o Roteiro de Abordagem (B1), que eram
 * duas chamadas com conteúdo sobreposto: "ações recomendadas" e "próximos
 * passos" diziam a mesma coisa com palavras diferentes.
 *
 * Diferente da rota antiga (/api/inteligencia), esta usa o pipeline comum de
 * lib/ai/server.ts. Com isso passa a enxergar o contexto de produto da
 * organização e a linha do tempo de Eventos, e grava event_id no histórico.
 *
 * A reunião é opcional. Com ela, a abordagem é preparada para aquela conversa;
 * sem ela, é a leitura geral do deal e do que fazer a seguir.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  supabaseFromRequest,
  carregarContexto,
  gerarJson,
  salvarOutput,
} from '@/lib/ai/server'

export const maxDuration = 60

export const OUTPUT_TYPE = 'abordagem'

const SYSTEM = `Você é um consultor sênior de vendas B2B corporativas, com 20 anos de experiência em ciclos longos, múltiplos decisores e concorrência forte.

Você assessora um vendedor específico sobre UMA oportunidade específica. Seu trabalho é responder a duas perguntas: "onde este deal realmente está?" e "o que eu faço agora, com quem, e como?". Nada de conselho genérico de vendas.

Quem vai ler é um vendedor com pressa, muitas vezes no celular, entre uma reunião e outra. Ele não relê. Se um argumento aparece duas vezes, ele perde a confiança no resto.

REGRA MAIS IMPORTANTE — CADA ACHADO TEM UM DONO:
Um mesmo ponto aparece em UMA seção apenas.
- "leitura_do_deal" diagnostica. É o único lugar com avaliação geral.
- "riscos" nomeia o que pode matar ou atrasar o deal. Não repita aqui o que já está na leitura; aprofunde.
- "abordagem_por_persona" diz como tratar cada pessoa. Não reargumente riscos.
- "objecoes" traz o que o cliente vai DIZER EM VOZ ALTA e a resposta falada.
- "proximos_passos" é checklist de execução: verbo no imperativo, dono e prazo. Sem justificativa — o porquê já está acima.

REGRAS DE QUALIDADE:
1. Use os nomes reais: pessoas, empresa, valores, prazos. "O decisor financeiro" é genérico; "a Marina, detratora, que vem do financeiro" é útil.
2. A experiência pessoal que o vendedor registrou sobre cada pessoa é a informação mais valiosa que você tem. Ela não está em nenhum CRM. Use-a.
3. Leia a LINHA DO TEMPO antes de concluir qualquer coisa. O feedback que o vendedor registrou depois de uma reunião vale mais que qualquer inferência sua. Se algo foi pedido pelo cliente e ainda não foi entregue, isso é prioridade.
4. Leve a sério o perfil de influência. Detrator se trata diferente de promotor; neutro é quem decide o empate.
5. Use o contexto econômico quando existir (orçamento, alçadas, restrições comerciais, pagamento). Nunca sugira uma concessão que as restrições do vendedor não permitem.
6. NUNCA afirme um compromisso comercial que não esteja registrado no contexto. O vendedor pode repetir sua frase em voz alta na sala. Exclusividade, prazo, desconto, condição de pagamento, quem arca com certificação: se não está no contexto, escreva como condição ("se sua empresa autorizar X, este é o momento; confirme antes") e liste em "lacunas".
7. Quando faltar informação, diga que falta. Apontar uma lacuna é entrega válida; inventar contexto não é.
8. Não elogie o vendedor nem suavize riscos.
9. Se uma REUNIÃO EM FOCO for informada, prepare tudo para ela: abertura, perguntas e objeções dizem respeito àquela conversa e àqueles participantes, e os próximos passos começam pelo que fazer antes dela.

FORMATO DA RESPOSTA:
Responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem blocos de código markdown. Todo o conteúdo em português do Brasil.

{
  "leitura_do_deal": "Até 70 palavras: onde o deal realmente está, independentemente do estágio cadastrado, e o que decide o resultado.",
  "temperatura": "quente | morna | fria",
  "riscos": [
    { "titulo": "Até 10 palavras", "detalhe": "Até 35 palavras", "severidade": "alto | medio | baixo" }
  ],
  "abertura": "Como abrir a próxima conversa. Até 45 palavras, em linguagem falada.",
  "abordagem_por_persona": [
    { "persona": "Nome", "papel": "O papel real desta pessoa na decisão. Até 12 palavras.", "angulo": "O que enfatizar com ela. Até 30 palavras.", "evitar": "O que evitar. Até 20 palavras." }
  ],
  "perguntas": [
    { "pergunta": "Pergunta aberta, na linguagem da conversa", "para": "Nome da persona ou 'Qualquer participante'", "objetivo": "O que você quer descobrir. Até 15 palavras." }
  ],
  "objecoes": [
    { "objecao": "O que a pessoa provavelmente vai dizer", "quem": "Nome da persona mais provável", "resposta": "O que dizer na hora. Até 40 palavras." }
  ],
  "proximos_passos": [
    { "acao": "Verbo no imperativo. Até 15 palavras.", "responsavel": "Vendedor ou nome da pessoa", "prazo": "imediato | esta_semana | proximas_semanas", "sinal_de_sucesso": "Como saber que funcionou. Até 15 palavras." }
  ],
  "lacunas": ["Informação que falta para uma leitura melhor. Lista vazia se o contexto bastou."]
}

LIMITES: 2 a 3 riscos (ordenados por severidade); uma entrada em abordagem_por_persona para cada persona cadastrada (ou, com reunião em foco, para cada participante); 3 perguntas; 3 objeções; 3 a 5 próximos passos (ordenados por prazo).

ANTES DE RESPONDER, RELEIA: se o mesmo argumento aparece em duas seções, apague de uma delas. Se uma frase pode ser cortada sem perder informação, corte.`

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseFromRequest(req)
    if (!supabase) {
      return NextResponse.json(
        { error: 'Sessão expirada. Entre de novo para continuar.' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const opportunityId: string = body.opportunityId
    const eventId: string | null = body.eventId ?? null

    if (!opportunityId) {
      return NextResponse.json({ error: 'Oportunidade não informada.' }, { status: 400 })
    }

    // Todas as personas entram: quem não vai à reunião ainda pesa na decisão.
    const contexto = await carregarContexto(supabase, opportunityId)

    // Reunião em foco (opcional). O RLS garante que só venha evento acessível.
    let blocoReuniao = '## REUNIÃO EM FOCO\nNenhuma. Faça a leitura geral do deal e do que fazer a seguir.'
    let tituloReuniao: string | null = null

    if (eventId) {
      const { data: evento } = await supabase
        .from('events')
        .select('title, occurred_at, objective, event_personas(persona_id)')
        .eq('id', eventId)
        .eq('opportunity_id', opportunityId)
        .maybeSingle()

      if (evento) {
        tituloReuniao = evento.title
        const nomes = ((evento.event_personas as { persona_id: string }[] | null) ?? [])
          .map((ep) => contexto.personas.find((p) => p.id === ep.persona_id)?.full_name)
          .filter(Boolean)

        blocoReuniao = [
          '## REUNIÃO EM FOCO',
          `- Título: ${evento.title}`,
          `- Data: ${new Date(evento.occurred_at).toLocaleDateString('pt-BR')}`,
          `- Participantes: ${nomes.length ? nomes.join(', ') : 'não informados'}`,
          `- Objetivo: ${evento.objective || 'não informado'}`,
        ].join('\n')
      }
    }

    const content = await gerarJson(
      SYSTEM,
      [
        {
          type: 'text',
          text: [
            contexto.texto,
            '',
            blocoReuniao,
            '',
            'Prepare a abordagem e os próximos passos. Responda apenas com o JSON.',
          ].join('\n'),
        },
      ],
      8000
    )

    const registro = {
      ...content,
      _meta: { event_id: eventId, reuniao: tituloReuniao },
    }

    const persistido = await salvarOutput(
      supabase,
      opportunityId,
      OUTPUT_TYPE,
      registro,
      eventId
    )

    return NextResponse.json({ content: registro, persisted: persistido })
  } catch (erro: unknown) {
    console.error('[abordagem]', erro)
    const mensagem = erro instanceof Error ? erro.message : 'Não foi possível gerar a abordagem.'
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}
