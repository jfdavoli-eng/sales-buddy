'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) {
      setError('Preencha e-mail e senha.')
      return
    }

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
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
        <p className="text-sm text-gray-400 mb-8">O segundo cerebro do vendedor B2B</p>

        <label className="block text-xs font-medium text-gray-600 mb-1.5">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
          className="w-full h-10 px-3 mb-4 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
        />

        <label className="block text-xs font-medium text-gray-600 mb-1.5">Senha</label>
        <div className="relative mb-2">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="********"
            className="w-full h-10 px-3 pr-10 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="text-right mb-5">
          <span className="text-xs text-[#185FA5] cursor-pointer hover:underline">Esqueci minha senha</span>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full h-10 bg-[#1B3A6B] text-white rounded-lg text-sm font-medium hover:bg-[#152d54] transition-colors disabled:opacity-60"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          Novo por aqui?{' '}
          <Link href="/signup" className="text-[#185FA5] hover:underline">Criar conta</Link>
        </p>
      </div>
    </div>
  )
}