'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

export type Persona = {
  id: string
  opportunity_id: string
  full_name: string
  job_title: string | null
  email: string | null
  linkedin_url: string | null
  influence_profile: string
  personal_experience: string | null
  created_at: string
}

const PROFILES = [
  { key: 'promotor', label: 'Promotor', badge: 'bg-[#EAF3DE] text-[#27500A]', active: 'bg-[#EAF3DE] text-[#27500A] border-[#C0DD97]', avatar: 'bg-[#EAF3DE] text-[#27500A]' },
  { key: 'neutro', label: 'Neutro', badge: 'bg-[#F1EFE8] text-[#444441]', active: 'bg-[#F1EFE8] text-[#444441] border-[#B4B2A9]', avatar: 'bg-[#F1EFE8] text-[#444441]' },
  { key: 'detrator', label: 'Detrator', badge: 'bg-[#FCEBEB] text-[#791F1F]', active: 'bg-[#FCEBEB] text-[#791F1F] border-[#F7C1C1]', avatar: 'bg-[#FCEBEB] text-[#791F1F]' },
]

function profileOf(key: string) {
  return PROFILES.find(p => p.key === key) || PROFILES[1]
}

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function PersonasTab({ opportunityId }: { opportunityId: string }) {
  const supabase = createClient()

  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Persona | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState('')

  const [fName, setFName] = useState('')
  const [fTitle, setFTitle] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fLinkedin, setFLinkedin] = useState('')
  const [fProfile, setFProfile] = useState('neutro')
  const [fExperience, setFExperience] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [editExperience, setEditExperience] = useState('')
  const [editingExp, setEditingExp] = useState(false)

  useEffect(() => { loadPersonas() }, [opportunityId])

  async function loadPersonas() {
    const { data } = await supabase
      .from('personas')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: true })
    setPersonas(data || [])
    setLoading(false)
  }

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function resetForm() {
    setFName(''); setFTitle(''); setFEmail(''); setFLinkedin('')
    setFProfile('neutro'); setFExperience(''); setFormError('')
  }

  async function handleCreate() {
    if (!fName.trim()) { setFormError('O nome é obrigatório.'); return }
    setSaving(true); setFormError('')

    const { error } = await supabase.from('personas').insert({
      opportunity_id: opportunityId,
      full_name: fName.trim(),
      job_title: fTitle.trim() || null,
      email: fEmail.trim() || null,
      linkedin_url: fLinkedin.trim() || null,
      influence_profile: fProfile,
      personal_experience: fExperience.trim() || null,
    })

    if (error) { setFormError('Erro ao salvar: ' + error.message); setSaving(false); return }

    await loadPersonas()
    resetForm()
    setShowForm(false)
    setSaving(false)
    flash('Persona adicionada')
  }

  async function changeProfile(persona: Persona, newProfile: string) {
    const { error } = await supabase
      .from('personas')
      .update({ influence_profile: newProfile, updated_at: new Date().toISOString() })
      .eq('id', persona.id)

    if (!error) {
      const updated = { ...persona, influence_profile: newProfile }
      setSelected(updated)
      setPersonas(personas.map(p => p.id === persona.id ? updated : p))
      flash('Perfil atualizado para ' + profileOf(newProfile).label)
    }
  }

  async function saveExperience(persona: Persona) {
    const { error } = await supabase
      .from('personas')
      .update({ personal_experience: editExperience.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', persona.id)

    if (!error) {
      const updated = { ...persona, personal_experience: editExperience.trim() || null }
      setSelected(updated)
      setPersonas(personas.map(p => p.id === persona.id ? updated : p))
      setEditingExp(false)
      flash('Experiência salva')
    }
  }

  async function deletePersona(persona: Persona) {
    if (!confirm(`Remover ${persona.full_name} desta oportunidade?`)) return
    const { error } = await supabase.from('personas').delete().eq('id', persona.id)
    if (!error) {
      setPersonas(personas.filter(p => p.id !== persona.id))
      setSelected(null)
      flash('Persona removida')
    }
  }

  function openPersona(p: Persona) {
    setSelected(p)
    setEditExperience(p.personal_experience || '')
    setEditingExp(false)
  }

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-8">Carregando personas...</p>
  }

  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Personas desta oportunidade
      </p>

      {personas.length === 0 && !showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mb-2">
          <p className="text-sm text-gray-400 mb-1">Nenhuma persona cadastrada</p>
          <p className="text-xs text-gray-400">
            Adicione as pessoas envolvidas na decisão de compra
          </p>
        </div>
      )}

      <div className="space-y-2 mb-2">
        {personas.map(p => {
          const prof = profileOf(p.influence_profile)
          return (
            <button
              key={p.id}
              onClick={() => openPersona(p)}
              className="w-full bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-2.5 hover:border-gray-300 transition-colors text-left"
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0 ${prof.avatar}`}>
                {initialsOf(p.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{p.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{p.job_title || 'Cargo não informado'}</p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${prof.badge}`}>
                {prof.label}
              </span>
              <svg className="w-4 h-4 text-gray-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )
        })}
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2.5 border border-dashed border-gray-300 rounded-xl text-[#185FA5] text-[13px] font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Adicionar persona
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Nova persona</p>

          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Nome <span className="text-red-500">*</span>
          </label>
          <input
            value={fName}
            onChange={e => setFName(e.target.value)}
            placeholder="Nome completo"
            className="w-full h-9 px-3 mb-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
          />

          <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo</label>
          <input
            value={fTitle}
            onChange={e => setFTitle(e.target.value)}
            placeholder="CFO, Diretor de TI, Gerente..."
            className="w-full h-9 px-3 mb-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
          />

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">E-mail</label>
              <input
                value={fEmail}
                onChange={e => setFEmail(e.target.value)}
                placeholder="nome@empresa.com"
                className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">LinkedIn</label>
              <input
                value={fLinkedin}
                onChange={e => setFLinkedin(e.target.value)}
                placeholder="linkedin.com/in/..."
                className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50"
              />
            </div>
          </div>

          <label className="block text-xs font-medium text-gray-600 mb-1.5">Perfil de influência</label>
          <div className="flex gap-1.5 mb-3">
            {PROFILES.map(p => (
              <button
                key={p.key}
                onClick={() => setFProfile(p.key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  fProfile === p.key ? p.active : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Experiência pessoal com esta persona
          </label>
          <textarea
            value={fExperience}
            onChange={e => setFExperience(e.target.value)}
            placeholder="Como essa pessoa se comporta, o que valoriza, como decide, histórico de interações..."
            rows={4}
            className="w-full px-3 py-2.5 mb-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50 resize-none leading-relaxed"
          />

          {formError && <p className="text-xs text-red-600 mb-2">{formError}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="flex-1 h-9 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-[2] h-9 bg-[#1B3A6B] hover:bg-[#152d54] text-white rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Adicionar persona'}
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-xl">

            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-200 sticky top-0 bg-white">
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
              >
                <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="text-[15px] font-semibold text-gray-900 flex-1">Perfil da persona</span>
              <button
                onClick={() => deletePersona(selected)}
                className="text-xs text-red-600 hover:underline"
              >
                Remover
              </button>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-3.5 pb-4 mb-4 border-b border-gray-200">
                <div className={`w-13 h-13 rounded-full flex items-center justify-center text-[17px] font-bold shrink-0 ${profileOf(selected.influence_profile).avatar}`} style={{ width: 52, height: 52 }}>
                  {initialsOf(selected.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-gray-900">{selected.full_name}</p>
                  <p className="text-xs text-gray-500 mb-1.5">{selected.job_title || 'Cargo não informado'}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {selected.email && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F1EFE8] text-[#444441]">
                        {selected.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Perfil de influência
              </p>
              <div className="flex gap-1.5 mb-5">
                {PROFILES.map(p => (
                  <button
                    key={p.key}
                    onClick={() => changeProfile(selected, p.key)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selected.influence_profile === p.key ? p.active : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Experiência pessoal
                </p>
                {!editingExp && (
                  <button
                    onClick={() => setEditingExp(true)}
                    className="text-[11px] text-[#185FA5] hover:underline"
                  >
                    Editar
                  </button>
                )}
              </div>

              {editingExp ? (
                <div>
                  <textarea
                    value={editExperience}
                    onChange={e => setEditExperience(e.target.value)}
                    rows={7}
                    placeholder="Como essa pessoa se comporta, o que valoriza, como decide..."
                    className="w-full px-3 py-2.5 mb-2 border border-gray-200 rounded-lg text-[13px] outline-none focus:border-[#185FA5] focus:ring-4 focus:ring-blue-50 resize-none leading-relaxed"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingExp(false); setEditExperience(selected.personal_experience || '') }}
                      className="flex-1 h-9 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => saveExperience(selected)}
                      className="flex-1 h-9 bg-[#1B3A6B] hover:bg-[#152d54] text-white rounded-lg text-sm font-medium"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {selected.personal_experience || (
                      <span className="text-gray-300">
                        Nenhuma experiência registrada. Esse campo alimenta a IA — quanto mais detalhe, melhor a simulação.
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[13px] px-4 py-2 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}