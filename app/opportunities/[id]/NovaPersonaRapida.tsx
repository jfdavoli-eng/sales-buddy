'use client'

/**
 * app/opportunities/[id]/NovaPersonaRapida.tsx
 *
 * D8 — cadastro de persona sem sair da tela.
 *
 * O vendedor está montando uma reunião (Eventos), uma simulação (Mocking) ou um
 * Dry Run e percebe que falta alguém. Antes, ele precisava ir até Cadastros,
 * perdendo o que já tinha preenchido. Agora cadastra ali mesmo.
 *
 * Só três campos — nome, cargo e perfil — porque o uso é no celular, no meio de
 * outra tarefa. A experiência pessoal (o que mais alimenta a IA) continua sendo
 * registrada em Cadastros › Personas; o lembrete no rodapé avisa isso.
 *
 * O componente não conhece a tela que o usa: ele insere no banco e devolve a
 * linha criada em `onCriada`. Cada tela decide o que fazer (em geral, adicionar
 * à lista e já deixar a pessoa marcada).
 */

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

const PERFIS = [
  { chave: 'promotor', rotulo: 'Promotor', ativo: 'bg-[#EAF3DE] text-[#27500A] border-[#C0DD97]' },
  { chave: 'neutro', rotulo: 'Neutro', ativo: 'bg-[#F1EFE8] text-[#444441] border-[#B4B2A9]' },
  { chave: 'detrator', rotulo: 'Detrator', ativo: 'bg-[#FCEBEB] text-[#791F1F] border-[#F7C1C1]' },
]

export default function NovaPersonaRapida({
  opportunityId,
  onCriada,
  tamanho = 'sm',
}: {
  opportunityId: string
  /** Recebe a linha completa da tabela personas, recém-criada. */
  onCriada: (persona: { id: string; [coluna: string]: unknown }) => void
  /** 'xs' acompanha os chips menores da aba Eventos. */
  tamanho?: 'xs' | 'sm'
}) {
  const supabase = useMemo(() => createClient(), [])

  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [perfil, setPerfil] = useState('neutro')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function fechar() {
    setAberto(false)
    setNome('')
    setCargo('')
    setPerfil('neutro')
    setErro('')
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro('O nome é obrigatório.')
      return
    }
    setSalvando(true)
    setErro('')

    // .select().single(): sem isso, um bloqueio silencioso do RLS passaria
    // como sucesso e a persona "sumiria" da tela.
    const { data, error } = await supabase
      .from('personas')
      .insert({
        opportunity_id: opportunityId,
        full_name: nome.trim(),
        job_title: cargo.trim() || null,
        influence_profile: perfil,
      })
      .select()
      .single()

    setSalvando(false)

    if (error || !data) {
      setErro('Não foi possível salvar: ' + (error?.message ?? 'sem retorno do banco'))
      return
    }

    onCriada(data)
    fechar()
  }

  const texto = tamanho === 'xs' ? 'text-xs' : 'text-sm'

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`rounded-full border border-dashed border-gray-300 px-3 py-1 ${texto} text-[#185FA5] hover:bg-blue-50`}
      >
        + Nova persona
      </button>
    )
  }

  return (
    <div className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              salvar()
            }
          }}
          placeholder="Nome completo *"
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-[#185FA5] focus:outline-none"
        />
        <input
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              salvar()
            }
          }}
          placeholder="Cargo"
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-[#185FA5] focus:outline-none"
        />
      </div>

      <div className="mt-2 flex gap-1.5">
        {PERFIS.map((p) => (
          <button
            key={p.chave}
            type="button"
            onClick={() => setPerfil(p.chave)}
            className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${
              perfil === p.chave ? p.ativo : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={fechar}
          className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="h-8 rounded-lg bg-[#1B3A6B] px-3 text-xs font-medium text-white hover:bg-[#152d54] disabled:opacity-60"
        >
          {salvando ? 'Salvando…' : 'Adicionar e marcar'}
        </button>
        <p className="ml-auto hidden text-[11px] text-gray-400 sm:block">
          Experiência pessoal: complete depois em Cadastros.
        </p>
      </div>
    </div>
  )
}
