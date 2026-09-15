/**
 * app/api/mocking-meeting/route.ts
 *
 * Mocking Meeting (requisito C1): a IA simula como cada persona vai se
 * comportar na reunião — reações, objeções, linguagem e postura — e como a sala
 * funciona quando essas pessoas estão juntas.
 *
 * Diferença de fundo em relação ao Dry Run: lá o objeto é um material, aqui são
 * pessoas. O material é opcional; o que não pode faltar é gente.
 *
 * Sobre a V2: cada persona simulada recebe um campo "voz", descrevendo como ela
 * fala e reage. Hoje isso é leitura para o vendedor. Quando o Mocking Meeting
 * virar chat interativo, é esse campo que instrui o agente de cada persona —
 * por isso ele é gerado agora, mesmo sem uso imediato.
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

export const maxDuration = 60

export const OUTPUT_TYPE = 'mocking'

/* -------------------------------------------------------------------------- */
/* O prompt                                                                    */
/* -------------------------------------------------------------------------- */

const SYSTEM = `Você é um consultor sênior de vendas B2B corporativas. Sua especialidade é ler a política interna de um comitê de compra: quem decide de fato, quem só opina alto, quem precisa de cobertura para dizer sim.

Sua tarefa é simular uma reunião que ainda vai acontecer. Não é escrever um roteiro de vendas — é antecipar o comportamento de pessoas específicas numa sala específica, e devolver ao vendedor o que ele precisa saber para conduzir.

O QUE SEPARA UMA BOA SIMULAÇÃO DE UMA GENÉRICA:

Uma simulação genérica diz que o técnico vai perguntar sobre integração e o financeiro sobre preço. Isso não ajuda ninguém — o vendedor já sabe.

Uma boa simulação usa o que está no contexto: o nome da pessoa, o perfil registrado, o que ela disse na última reunião, o feedback que o vendedor anotou depois. Se o histórico mostra que alguém pediu algo e não recebeu, essa pessoa entra na próxima reunião diferente — mais fria, mais impaciente, ou já convencida de que não vai receber. Simule isso.

REGRAS:

1. Trate cada persona como indivíduo, com nome. Se o perfil diz promotor, ela chega querendo que dê certo — e a ameaça é ela não conseguir defender internamente, não ela rejeitar. Se diz detrator, as objeções são mais políticas que técnicas: ela quer que o projeto não avance, e vai usar argumentos legítimos para isso.

2. Escreva as falas como a pessoa falaria, não como um manual escreveria. Gente interrompe, ironiza, faz pergunta que já tem resposta, e às vezes o que trava a reunião é o tom, não o conteúdo.

3. A dinâmica entre as pessoas costuma decidir mais que o argumento. Quem olha para quem antes de responder, quem cala quando o chefe fala, quem usa a dúvida do colega para reforçar a própria posição. Se houver duas ou mais personas, esta é a parte mais valiosa da sua resposta.

4. NUNCA AFIRME O QUE NÃO ESTÁ NO CONTEXTO (cadastros, linha do tempo ou material anexado). Esta é a regra que mais protege o vendedor, porque ele vai levar suas respostas para dentro da sala e pode confirmar em voz alta algo que a empresa dele nunca autorizou — ou que simplesmente não é verdade.

A regra cobre três coisas:
a) Compromissos comerciais e operacionais (detalhados abaixo), incluindo quem coordena certificação ou onboarding e quem é ponto de contato.
b) Capacidades do vendedor e do fabricante: certificações, homologações, casos, referências, histórico com outros clientes, produtos em desenvolvimento. Se o material anexado afirma, pode usar citando o material; se não, não existe.
c) Dados de mercado: crescimento de segmento, volume de licitações, tendências, números.

Nunca escreva uma resposta que prometa trazer material que você não sabe se existe ("posso trazer referências de…"). Nenhuma resposta pode afirmar como fato algo que você listou em "faltou_informacao".

Exclusividade, quem paga certificação, prazo de entrega, condição de pagamento, desconto, investimento de entrada, quem assume custo de homologação: nada disso pode ser dado como fato se não estiver no contexto econômico, nas restrições comerciais ou na linha do tempo.

Quando precisar tocar num desses pontos, escreva como condição e não como afirmação. Em vez de "confirme exclusividade de marca no Brasil", escreva "se a sua empresa autorizar exclusividade de marca, este é o momento de usá-la — confirme antes da reunião". Em vez de "o custo de certificação é seu, não do cliente", escreva "defina antes quem assume o custo de certificação; sem isso definido, não responda a essa pergunta na sala".

E acrescente em "faltou_informacao" cada compromisso, capacidade ou dado que você precisou supor.

7. Respeite a DATA DE HOJE informada no contexto. Eventos agendados ainda não aconteceram: não cite o que foi dito neles.

5. Respeite as restrições comerciais registradas pelo vendedor. Nunca sugira uma concessão que ele registrou não poder dar.

6. Quando o contexto for pobre, diga o que falta em vez de preencher com invenção. Uma simulação honesta e curta vale mais que uma longa e imaginada.

FORMATO DA RESPOSTA:
Responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem blocos de código markdown. Português do Brasil.

{
  "leitura_da_sala": "Até 80 palavras. Quem manda de fato nesta reunião, o que está em jogo para cada lado, e qual é o risco central.",
  "abertura_sugerida": "As duas ou três primeiras frases que o vendedor deveria dizer, escritas para serem faladas em voz alta.",
  "personas": [
    {
      "nome": "Nome exato como aparece no contexto",
      "postura": "Como ela chega na reunião. Uma frase.",
      "voz": "Como ela fala: vocabulário, ritmo, o que valoriza, como reage a pressão. Até 40 palavras. Escreva isto como se fosse instruir um ator a interpretá-la.",
      "o_que_busca": "A agenda pessoal dela nesta reunião — que pode não ser a agenda da empresa.",
      "objecoes": [
        {
          "fala": "A objeção na primeira pessoa, do jeito que ela diria em voz alta.",
          "por_tras": "O que ela realmente está querendo saber ou proteger.",
          "resposta": "O que responder. Até 40 palavras."
        }
      ],
      "sinais": "O que observar nela durante a reunião para saber se está indo bem ou mal."
    }
  ],
  "dinamica": [
    {
      "momento": "Quando na reunião isso tende a acontecer.",
      "o_que_acontece": "A interação entre as pessoas, com nomes.",
      "como_conduzir": "O que o vendedor faz nesse momento. Até 35 palavras."
    }
  ],
  "risco_de_descarrilamento": {
    "gatilho": "O assunto ou momento que pode derrubar a reunião.",
    "como_evitar": "Até 40 palavras."
  },
  "faltou_informacao": ["O que você precisaria saber para simular melhor. Lista vazia se o contexto foi suficiente."]
}

LIMITES: 2 a 3 objeções por persona. 2 a 4 momentos em "dinamica" — e devolva lista vazia se houver apenas uma persona, porque não há dinâmica com uma pessoa só.

ANTES DE RESPONDER, RELEIA E CORRIJA:
1. Se duas personas estão dizendo a mesma coisa com palavras diferentes, você não as diferenciou o bastante. Dê a cada uma o que só ela diria.
2. Alguma resposta, abertura ou condução afirma certificação, caso, compromisso, dado de mercado ou papel da empresa do vendedor que não está no contexto? Reescreva como pergunta ou condição.
3. Alguma resposta contradiz um item de "faltou_informacao"? Corrija a resposta.`

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
    const personaIds: string[] = body.personaIds ?? []
    const documentId: string | null = body.documentId || null
    const objetivo: string = (body.objetivo ?? '').trim()
    const desafio: string = (body.desafio ?? '').trim()
    const eventId: string | null = body.eventId ?? null

    if (!opportunityId) {
      return NextResponse.json({ error: 'Oportunidade não informada.' }, { status: 400 })
    }

    if (personaIds.length === 0) {
      return NextResponse.json(
        {
          error:
            'Escolha ao menos uma persona. Sem gente na sala não há reunião para simular.',
        },
        { status: 400 }
      )
    }

    const contexto = await carregarContexto(supabase, opportunityId, personaIds)

    const blocos: BlocoConteudo[] = []

    // O material é opcional aqui — muita reunião de discovery não tem deck.
    let nomeDocumento: string | null = null
    if (documentId) {
      const documento = await carregarPdf(supabase, documentId)
      nomeDocumento = documento.registro.file_name
      blocos.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: documento.base64,
        },
      })
    }

    blocos.push({
      type: 'text',
      text: [
        nomeDocumento
          ? `Material que será apresentado: ${nomeDocumento}`
          : 'Nenhum material será apresentado nesta reunião — simule a conversa.',
        '',
        contexto.texto,
        '',
        objetivo
          ? `## OBJETIVO DESTA REUNIÃO\n${objetivo}`
          : '## OBJETIVO DESTA REUNIÃO\nNão informado pelo vendedor.',
        '',
        desafio
          ? `## O QUE PREOCUPA O VENDEDOR NESTA REUNIÃO\n${desafio}`
          : '',
        '',
        'Simule esta reunião. Responda apenas com o JSON.',
      ]
        .filter((l) => l !== '')
        .join('\n'),
    })

    const content = await gerarJson(SYSTEM, blocos, 8000)

    const registro = {
      ...content,
      _meta: {
        documento_id: documentId,
        documento_nome: nomeDocumento,
        personas: contexto.personas.map((p: any) => p.name ?? p.nome ?? null),
        objetivo: objetivo || null,
        desafio: desafio || null,
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
    console.error('[mocking-meeting]', erro)
    return NextResponse.json(
      { error: erro?.message ?? 'Não foi possível simular a reunião.' },
      { status: 500 }
    )
  }
}