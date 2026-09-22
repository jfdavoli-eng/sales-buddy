/**
 * lib/supabase-client.ts
 *
 * Cliente do Supabase para componentes de navegador.
 *
 * Por que não criamos o cliente na hora em que `createClient()` é chamado:
 * as telas são componentes 'use client', mas o Next as pré-renderiza no
 * servidor durante o build. Nesse momento, criar o cliente exigia as variáveis
 * de ambiente — e qualquer ambiente de build sem elas derrubava o build
 * inteiro ("Invalid supabaseUrl"), mesmo que em produção as variáveis
 * existissem.
 *
 * A solução é adiar: `createClient()` devolve um proxy e o cliente de verdade
 * só nasce no primeiro uso — sempre dentro de um efeito, de um evento ou de uma
 * chamada assíncrona, ou seja, sempre no navegador. Pré-renderizar deixou de
 * depender de configuração.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let instancia: SupabaseClient | null = null

function clienteReal(): SupabaseClient {
  if (instancia) return instancia

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !chave) {
    // Mensagem explícita: se algum dia faltar variável em produção, o erro no
    // console diz o que fazer em vez de falar de URL inválida.
    throw new Error(
      'Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY nas variáveis de ambiente.'
    )
  }

  instancia = createBrowserClient(url, chave)
  return instancia
}

export function createClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get(_alvo, propriedade) {
      const cliente = clienteReal() as unknown as Record<string | symbol, unknown>
      const valor = cliente[propriedade]
      return typeof valor === 'function' ? valor.bind(cliente) : valor
    },
  })
}
