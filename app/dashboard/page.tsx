'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [orgName, setOrgName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, organizations(name)')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setOrgName(profileData.organizations?.name || '')
      }

      setLoading(false)
    }

    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '??'

  return (
    <div className="min-h-screen bg-gray-50">

      <header className="bg-white border-b border-gray-200 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1B3A6B] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M10 2C6 2 3 5 3 9c0 2.4 1.1 4.5 2.8 5.9L5 17h10l-.8-2.1C15.9 13.5 17 11.4 17 9c0-4-3-7-7-7z" />
              <path d="M7 9h6M8 12h4" />
            </svg>
          </div>
          <span className="text-base font-semibold text-[#1B3A6B] tracking-tight">Sales Buddy</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-xs font-semibold text-[#1B3A6B]">
          {initials}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">
            Bem-vindo, {profile?.full_name}
          </h1>
          <p className="text-sm text-gray-500 mb-4">
            {orgName} · {profile?.role === 'gestor' ? 'Gestor' : 'Vendedor'}
          </p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900">
            Autenticação funcionando. Organização e perfil criados com sucesso no banco de dados.
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Próximos passos
          </p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>Lista de oportunidades</li>
            <li>Formulário de nova oportunidade</li>
            <li>Detalhe da oportunidade com abas</li>
            <li>Features de IA</li>
          </ul>
        </div>
        <Link
          href="/configuracoes"
          className="block w-full mt-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium text-center hover:bg-gray-50 transition-colors"
        >
          Configurações
        </Link>
        <button
          onClick={handleLogout}
          className="w-full mt-4 py-2.5 border border-red-200 text-red-700 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
        >
          Sair da conta
        </button>
      </main>
    </div>
  )
}