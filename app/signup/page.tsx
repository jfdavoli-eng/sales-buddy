'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignup() {
    if (!fullName || !orgName || !email || !password) {
      setError('Preencha todos os campos.')
      return
    }
    if (password.length < 6) {
      setError('A senha precisa ter no mínimo 6 caracteres.')
      return
    }

    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          org_name: orgName,
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setError('Conta criada. Faça login para continuar.')
        setLoading(false)
        return
      }
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8">

        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 bg-[#1B3A6B] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M10 2C6 2 3 5 3 9c0 2.4 1.1 4.5 2.8 5.9L5 17h10l-.8-2.1C15.9 13.5 17 11.4 17 9c0-4-3-7-7-7z" />
              <path d="M7 9h6M8 12h4" />
            </svg>
          </div>
          <span className="text-xl font-semibold text-[#1B3A6B] tracking-tight">Sales Buddy</span>
        </div>
        <p className="text-sm text-gray-400 mb-8">Criar sua conta</p>

        <label className="block text-xs font-medium text-gray-600 mb-1.5">Seu nome</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Juliano Davoli"
          className="w-full h-10 px-3 mb-4 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
        />

        <label className="block text-xs font-medium text-gray-600 mb-1.5">Empresa</label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Nome da sua empresa"
          className="w-full h-10 px-3 mb-4 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
        />

        <label className="block text-xs font-medium text-gray-600 mb-1.5">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
          className="w-full h-10 px-3 mb-4 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
        />

        <label className="block text-xs font-medium text-gray-600 mb-1.5">Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
          placeholder="Mínimo 6 caracteres"
          className="w-full h-10 px-3 mb-4 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
        />

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full h-10 bg-[#1B3A6B] text-white rounded-lg text-sm font-medium hover:bg-[#152d54] transition-colors disabled:opacity-60 mt-2"
        >
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          Já tem conta?{' '}
          <Link href="/login" className="text-[#185FA5] hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  )
}