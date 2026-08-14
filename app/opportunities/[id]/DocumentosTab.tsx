'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Persona = {
  id: string
  name: string
}

type DocumentRow = {
  id: string
  opportunity_id: string
  persona_id: string | null
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  created_at: string | null
}

type Props = {
  opportunityId: string
}

const ACCEPTED = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
} as const

const MAX_BYTES = 10 * 1024 * 1024

const TYPE_BADGE: Record<string, string> = {
  PDF: 'bg-[#FAEEDA] text-[#633806]',
  DOCX: 'bg-[#E6F1FB] text-[#0C447C]',
  PPTX: 'bg-[#EEEDFE] text-[#3C3489]',
  ARQUIVO: 'bg-[#F1EFE8] text-[#444441]',
}

function labelForMime(mime: string | null): string {
  if (!mime) return 'ARQUIVO'
  return ACCEPTED[mime as keyof typeof ACCEPTED] ?? 'ARQUIVO'
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Remove acentos e caracteres que o Storage rejeita no caminho.
function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120)
}

export default function DocumentosTab({ opportunityId }: Props) {
  const supabase = createClient()

  const [orgId, setOrgId] = useState<string | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [personaId, setPersonaId] = useState<string>('')
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const notify = useCallback((type: 'error' | 'success', text: string) => {
    setMessage({ type, text })
    window.setTimeout(() => setMessage(null), 4000)
  }, [])

  const loadDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, opportunity_id, persona_id, file_name, file_path, file_size, mime_type, created_at')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })

    if (error) {
      notify('error', 'Não foi possível carregar os documentos.')
      return
    }
    setDocuments(data ?? [])
  }, [supabase, opportunityId, notify])

  useEffect(() => {
    let active = true

    async function init() {
      setLoading(true)

      const { data: auth } = await supabase.auth.getUser()
      if (auth?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', auth.user.id)
          .single()
        if (active) setOrgId(profile?.organization_id ?? null)
      }

      const { data: personaRows } = await supabase
        .from('personas')
        .select('id, name')
        .eq('opportunity_id', opportunityId)
        .order('name')

      if (active) setPersonas(personaRows ?? [])

      await loadDocuments()
      if (active) setLoading(false)
    }

    init()
    return () => {
      active = false
    }
  }, [supabase, opportunityId, loadDocuments])

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return

    if (!orgId) {
      notify('error', 'Organização não identificada. Recarregue a página.')
      return
    }

    setUploading(true)

    for (const file of list) {
      if (!(file.type in ACCEPTED)) {
        notify('error', `${file.name}: formato não aceito. Use PDF, DOCX ou PPTX.`)
        continue
      }
      if (file.size > MAX_BYTES) {
        notify('error', `${file.name}: acima do limite de 10 MB.`)
        continue
      }

      const path = `${orgId}/${opportunityId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadError) {
        notify('error', `${file.name}: falha no envio. ${uploadError.message}`)
        continue
      }

      const { error: insertError } = await supabase.from('documents').insert({
        opportunity_id: opportunityId,
        persona_id: personaId || null,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
      })

      if (insertError) {
        // Registro falhou: remove o arquivo para não deixar órfão no Storage.
        await supabase.storage.from('documents').remove([path])
        notify('error', `${file.name}: não foi possível registrar o documento.`)
        continue
      }

      notify('success', `${file.name} enviado.`)
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    await loadDocuments()
  }

  async function handleDownload(doc: DocumentRow) {
    setBusyId(doc.id)
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60)
    setBusyId(null)

    if (error || !data?.signedUrl) {
      notify('error', 'Não foi possível abrir o arquivo.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleDelete(doc: DocumentRow) {
    const ok = window.confirm(`Remover "${doc.file_name}"? Esta ação não pode ser desfeita.`)
    if (!ok) return

    setBusyId(doc.id)

    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([doc.file_path])

    if (storageError) {
      setBusyId(null)
      notify('error', 'Não foi possível remover o arquivo.')
      return
    }

    const { error: rowError } = await supabase.from('documents').delete().eq('id', doc.id)
    setBusyId(null)

    if (rowError) {
      notify('error', 'Arquivo removido, mas o registro permaneceu. Recarregue a página.')
      return
    }

    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    notify('success', 'Documento removido.')
  }

  function personaName(id: string | null): string | null {
    if (!id) return null
    return personas.find((p) => p.id === id)?.name ?? null
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'error'
              ? 'bg-[#FDECEC] text-[#8C1D1D]'
              : 'bg-[#E8F5EE] text-[#0F5132]'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Enviar documento</h3>
            <p className="text-sm text-gray-500">
              PDF, DOCX ou PPTX até 10 MB. A IA usa esses arquivos para gerar inteligência.
            </p>
          </div>

          <label className="text-sm text-gray-600">
            <span className="mr-2">Associar a:</span>
            <select
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0C447C] focus:outline-none"
            >
              <option value="">A oportunidade</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          role="button"
          tabIndex={0}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition focus:outline-none focus:ring-2 focus:ring-[#0C447C] ${
            dragging
              ? 'border-[#0C447C] bg-[#E6F1FB]'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          {uploading ? (
            <p className="text-sm font-medium text-gray-700">Enviando…</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                Arraste os arquivos ou clique para escolher
              </p>
              <p className="mt-1 text-xs text-gray-500">Vários arquivos de uma vez</p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.pptx"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Documentos {documents.length > 0 && <span className="text-gray-400">({documents.length})</span>}
        </h3>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <p className="text-sm text-gray-600">Nenhum documento por aqui ainda.</p>
            <p className="mt-1 text-sm text-gray-500">
              Envie a proposta ou a apresentação para a IA analisar.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {documents.map((doc) => {
              const type = labelForMime(doc.mime_type)
              const linked = personaName(doc.persona_id)
              return (
                <li key={doc.id} className="flex items-center gap-4 px-4 py-3">
                  <span
                    className={`shrink-0 rounded px-2 py-1 text-[11px] font-semibold tracking-wide ${
                      TYPE_BADGE[type] ?? TYPE_BADGE.ARQUIVO
                    }`}
                  >
                    {type}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{doc.file_name}</p>
                    <p className="text-xs text-gray-500">
                      {formatSize(doc.file_size)} · {formatDate(doc.created_at)}
                      {linked && <> · {linked}</>}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={busyId === doc.id}
                    className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Abrir
                  </button>

                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={busyId === doc.id}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-[#8C1D1D] hover:bg-[#FDECEC] disabled:opacity-50"
                  >
                    Remover
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}