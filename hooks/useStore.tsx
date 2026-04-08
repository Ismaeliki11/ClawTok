'use client'

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react'
import type { AppSnapshot, Carpeta, ImportacionReciente, Nota } from '@/lib/types'
import {
  deleteNote,
  fetchAppState,
  updateNote,
} from '@/lib/client/api'

interface StoreValue {
  carpetas: Carpeta[]
  notas: Nota[]
  importaciones: ImportacionReciente[]
  importacionesEnProceso: ImportacionReciente[]
  notasRecientes: Nota[]
  notasEnProceso: Nota[]
  inicializado: boolean
  eliminarNota: (id: string) => Promise<void>
  editarNota: (id: string, updates: Partial<Nota>) => Promise<void>
  notasPorCarpeta: (carpetaId: string) => Nota[]
  contarPorCarpeta: (carpetaId: string) => number
  buscar: (query: string) => Nota[]
  refresh: () => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

function applySnapshot(
  snapshot: AppSnapshot,
  setters: {
    setCarpetas: (value: Carpeta[]) => void
    setImportaciones: (value: ImportacionReciente[]) => void
    setNotas: (value: Nota[]) => void
  }
) {
  startTransition(() => {
    setters.setCarpetas(snapshot.carpetas)
    setters.setImportaciones(snapshot.importaciones)
    setters.setNotas(snapshot.notas)
  })
}

function useProvideStore(): StoreValue {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [importaciones, setImportaciones] = useState<ImportacionReciente[]>([])
  const [inicializado, setInicializado] = useState(false)
  const refreshInFlightRef = useRef(false)

  const hydrate = (snapshot: AppSnapshot) => {
    applySnapshot(snapshot, { setCarpetas, setImportaciones, setNotas })
  }

  const refresh = async () => {
    if (refreshInFlightRef.current) {
      return
    }

    refreshInFlightRef.current = true
    try {
      const response = await fetchAppState()
      hydrate(response.snapshot)
    } finally {
      refreshInFlightRef.current = false
    }
  }

  const refreshEvent = useEffectEvent(async () => {
    await refresh()
  })

  useEffect(() => {
    let cancelled = false

    void fetchAppState()
      .then((response) => {
        if (!cancelled) {
          hydrate(response.snapshot)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInicializado(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const notasRecientes = notas
    .filter((note) => note.estadoProcesado === 'completado')
    .sort((left, right) => {
      return new Date(right.creadoEn).getTime() - new Date(left.creadoEn).getTime()
    })
    .slice(0, 6)

  const notasEnProceso = notas.filter((note) => {
    return note.estadoProcesado !== 'completado' && note.estadoProcesado !== 'error'
  })
  const importacionesEnProceso = importaciones.filter((item) => {
    return item.estado !== 'completado' && item.estado !== 'error'
  })

  useEffect(() => {
    if (!inicializado || importacionesEnProceso.length === 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      void refreshEvent()
    }, 4000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [inicializado, importacionesEnProceso.length])

  return {
    carpetas,
    notas,
    importaciones,
    importacionesEnProceso,
    notasRecientes,
    notasEnProceso,
    inicializado,
    eliminarNota: async (id: string) => {
      const response = await deleteNote(id)
      hydrate(response.snapshot)
    },
    editarNota: async (id: string, updates: Partial<Nota>) => {
      const response = await updateNote(id, {
        notaPersonal: updates.notaPersonal,
        titulo: updates.titulo,
      })
      hydrate(response.snapshot)
    },
    notasPorCarpeta: (carpetaId: string) => {
      return notas.filter((note) => {
        return note.carpetaId === carpetaId && note.estadoProcesado === 'completado'
      })
    },
    contarPorCarpeta: (carpetaId: string) => {
      return notas.filter((note) => {
        return note.carpetaId === carpetaId && note.estadoProcesado === 'completado'
      }).length
    },
    buscar: (query: string) => {
      const normalized = query.toLowerCase().trim()
      if (!normalized) {
        return []
      }

      return notas.filter((note) => {
        if (note.estadoProcesado !== 'completado') {
          return false
        }

        const haystack = [
          note.titulo,
          note.resumen,
          note.utilidad,
          ...note.etiquetas,
          ...note.puntosClave,
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(normalized)
      })
    },
    refresh,
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const store = useProvideStore()
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('useStore must be used inside StoreProvider')
  }

  return store
}
