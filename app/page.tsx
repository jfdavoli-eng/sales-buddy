'use client'

/**
 * app/page.tsx
 *
 * Porta de entrada do app. Era a página de exemplo do create-next-app, que
 * ninguém via em desenvolvimento porque sempre entrávamos direto em /login ou
 * /dashboard — mas é a primeira tela de quem abre o endereço do app.
 *
 * Ela não mostra nada: decide para onde o visitante vai. Com sessão ativa, o
 * vendedor cai no dashboard; sem sessão, no login.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function Home() {
  const router = useRouter()
  const [demorou, setDemorou] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Se a verificação travar (rede ruim no celular, entre reuniões), o link
    // abaixo evita que a pessoa fique olhando uma tela em branco.
    const aviso = setTimeout(() => setDemorou(true), 4000)

    supabase.auth
      .getUser()
      .then(({ data }) => {
        router.replace(data.user ? '/dashboard' : '/login')
      })
      .catch(() => router.replace('/login'))
      .finally(() => clearTimeout(aviso))

    return () => clearTimeout(aviso)
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="text-center">
        <p className="text-sm text-gray-500">Abrindo o Sales Buddy…</p>
        {demorou && (
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="mt-3 text-sm font-medium text-[#185FA5] hover:underline"
          >
            Ir para o login
          </button>
        )}
      </div>
    </div>
  )
}
