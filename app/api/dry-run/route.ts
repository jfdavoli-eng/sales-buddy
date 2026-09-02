/**
 * app/api/dry-run/route.ts
 *
 * Dry Run (requisito C2): o vendedor escolhe um material já enviado na aba
 * Cadastros e a IA antecipa questionamentos, críticas, pedidos de desconto e
 * pontos fracos — com sugestões de como reforçá-los.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  supabaseFromRequest,
  carregarContexto,
  carregarPdf,
  gerarJson,
  salvarOutput,
  BlocoConteudo,
} from '@/lib/ai/server'

/** Vercel encerra funções em 10s por padrão. A meta acordada é 45s. */
export const maxDuration = 60

export const OUTPUT_TYPE = 'dryrun'

/* -------------------------------------------------------------------------- */
/* O prompt — a parte mais valiosa do produto                                 */
/* -------------------------------------------------------------------------- */

const SYSTEM = `Você é um consultor sênior de vendas B2B corporativas com 20 anos de experiência em negociações complexas. Seu trabalho agora é fazer um "dry run": ler um material comercial pelos olhos de quem vai recebê-lo e apontar, sem suavizar, o que vai dar errado na reunião.

Você NÃO é um revisor de texto. Não comente diagramação, fontes ou gramática. Comente estratégia comercial: o que o cliente vai questionar, onde a proposta abre flanco para desconto, o que está afirmado sem prova, o que foi omitido e vai ser cobrado.

Quem vai ler você é um vendedor com pressa, muitas vezes no celular, minutos antes da reunião. Ele não vai reler nada. Se um argumento aparecer duas vezes, ele perde a confiança de que vale a pena ler até o fim.

REGRA MAIS IMPORTANTE — CADA ACHADO TEM UM DONO:
Um mesmo problema aparece em UMA seção apenas. Se o slide 11 é um ponto fraco, ele não é reargumentado no ajuste prioritário nem na pergunta esperada. As seções não se repetem porque têm funções diferentes:

- "pontos_fracos" é a ÚNICA seção que diagnostica e argumenta. Todo o raciocínio mora aqui.
- "ajustes_prioritarios" é checklist de execução. Frases curtas e imperativas, sem justificativa — o porquê já está no ponto fraco.
- "questionamentos_esperados" traz o que o cliente vai PERGUNTAR EM VOZ ALTA e o que responder na hora. Prefira perguntas que NÃO correspondam a um ponto fraco já listado. Se uma pergunta tratar do mesmo achado, ela só entra quando a resposta falada for diferente de "como reforçar" — e aí vá direto à resposta, sem repetir o diagnóstico.

REGRAS DE QUALIDADE:

1. Use os nomes reais que aparecem no contexto: pessoas, empresa, valores, prazos. "O decisor financeiro" é análise genérica; "a Marina, que é detratora e vem do financeiro" é análise útil.

2. Ancore cada crítica em algo concreto do material: slide, seção ou afirmação específica.

3. Leve a sério o perfil das personas. Um promotor questiona diferente de um detrator. Se o contexto diz que alguém é detrator, as objeções dele devem ser mais duras e mais políticas.

4. Use a experiência pessoal registrada pelo vendedor e o objetivo da reunião. Um material de discovery é julgado por critérios diferentes de uma proposta de fechamento.

5. Leia a LINHA DO TEMPO antes de julgar o material. O que já aconteceu muda tudo: se o cliente já pediu algo em reunião anterior e o material não entrega, isso é o ponto fraco mais grave que existe. O feedback que o vendedor registrou depois de uma reunião vale mais que qualquer inferência sua — é o que de fato aconteceu na sala.

6. Use o contexto econômico quando existir: orçamento do cliente, alçadas de aprovação, restrições comerciais do vendedor e premissas de pagamento. Eles mudam a leitura da pressão por desconto e do ritmo do deal. Nunca sugira uma concessão que as restrições comerciais do vendedor não permitem.

7. Quando faltar informação, diga que falta. Não invente contexto para preencher uma análise bonita.

8. Nada de conselho genérico de vendas. "Reforce o ROI" não serve. "Troque a promessa de 30% de redução de custo por um caso do setor têxtil com número auditado, porque a Marina vai pedir a fonte" serve.

FORMATO DA RESPOSTA:
Responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem blocos de código markdown. Escreva todo o conteúdo em português do Brasil.

{
  "resumo": "Até 70 palavras: o material sustenta esta conversa ou não, e qual é o risco central.",
  "ajustes_prioritarios": ["3 a 5 linhas de checklist. Até 15 palavras cada. Comece pelo verbo e cite o slide. Sem justificativa. Ex.: 'Slide 11: trocar 150K câmeras por caso nomeado com país e volume.'"],
  "pontos_fracos": [
    {
      "ponto": "O que está frágil e onde aparece. Até 20 palavras.",
      "por_que": "Por que isso vira problema com estas pessoas. Até 40 palavras.",
      "como_reforcar": "O que fazer, concretamente. Até 40 palavras."
    }
  ],
  "questionamentos_esperados": [
    {
      "pergunta": "A pergunta na linguagem que a pessoa realmente usaria.",
      "quem": "Nome da persona mais provável (ou 'Qualquer participante')",
      "resposta_sugerida": "O que dizer na hora. Até 45 palavras. Sem repetir diagnóstico."
    }
  ],
  "risco_desconto": {
    "probabilidade": "alta | media | baixa",
    "justificativa": "Até 40 palavras.",
    "como_defender": "A linha de defesa e o que oferecer no lugar de preço. Até 50 palavras."
  },
  "pontos_fortes": ["O que já está bom e deve ser enfatizado. Até 25 palavras cada."],
  "faltou_informacao": ["O que você precisaria saber para uma análise melhor. Lista vazia se o contexto foi suficiente."]
}

LIMITES: 3 a 4 itens em pontos_fracos, 3 a 4 em questionamentos_esperados, 3 em pontos_fortes.

ANTES DE RESPONDER, RELEIA SUA PRÓPRIA RESPOSTA: se o mesmo slide ou o mesmo argumento aparece em duas seções, apague de uma delas. Se uma frase pode ser cortada sem perder informação, corte.`

/* -------------------------------------------------------------------------- */
/* A rota                                                                      */
/* -------------------------------------------------------------------------- */

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
    const documentId: string = body.documentId
    const personaIds: string[] = body.personaIds ?? []
    const objetivo: string = (body.objetivo ?? '').trim()
    const eventId: string | null = body.eventId ?? null

    if (!opportunityId || !documentId) {
      return NextResponse.json(
        { error: 'Escolha o material que quer analisar.' },
        { status: 400 }
      )
    }

    // 1. Contexto da oportunidade, personas selecionadas e linha do tempo
    const contexto = await carregarContexto(supabase, opportunityId, personaIds)

    // 2. O PDF
    const documento = await carregarPdf(supabase, documentId)

    // 3. Montagem da mensagem: documento primeiro, instrução depois.
    //    A ordem importa — o modelo lê melhor quando o material antecede a
    //    pergunta sobre o material.
    const blocos: BlocoConteudo[] = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: documento.base64,
        },
      },
      {
        type: 'text',
        text: [
          `Material analisado: ${documento.registro.file_name}`,
          '',
          contexto.texto,
          '',
          objetivo
            ? `## OBJETIVO DESTA REUNIÃO\n${objetivo}`
            : '## OBJETIVO DESTA REUNIÃO\nNão informado pelo vendedor.',
          '',
          'Faça o dry run deste material considerando quem vai recebê-lo. Responda apenas com o JSON.',
        ].join('\n'),
      },
    ]

    // 4. Geração
    //    8000 tokens: a análise da Intelbras estourou 4000. Uma proposta densa
    //    gera pontos fracos e perguntas com resposta, e cada item é um
    //    parágrafo. Cortar pela metade destrói o valor da feature.
    const content = await gerarJson(SYSTEM, blocos, 8000)

    // 5. Histórico — enriquecido com o que foi analisado, para a tela mostrar
    //    depois qual material gerou aquela versão.
    const registro = {
      ...content,
      _meta: {
        documento_id: documentId,
        documento_nome: documento.registro.file_name,
        personas: contexto.personas.map((p: any) => p.name ?? p.nome ?? null),
        objetivo: objetivo || null,
        event_id: eventId,
      },
    }

    const persistido = await salvarOutput(
      supabase,
      opportunityId,
      OUTPUT_TYPE,
      registro,
      eventId
    )

    return NextResponse.json({ content: registro, persisted: persistido })
  } catch (erro: any) {
    console.error('[dry-run]', erro)
    return NextResponse.json(
      { error: erro?.message ?? 'Não foi possível gerar o Dry Run.' },
      { status: 500 }
    )
  }
}