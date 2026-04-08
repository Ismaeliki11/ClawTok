export type ProcessingStatus =
  | 'pendiente'
  | 'procesando'
  | 'analizando'
  | 'organizando'
  | 'completado'
  | 'error'

export interface GlosarioItem {
  termino: string
  definicion: string
}

export interface Carpeta {
  id: string
  nombre: string
  icono: string
  color: string
  creadoEn: string
}

export interface TikTokMetricas {
  comentarios?: string | null
  compartidos?: string | null
  guardados?: string | null
  likes?: string | null
  reproducciones?: string | null
}

export interface TikTokComentario {
  autor?: string
  likes?: number | null
  texto: string
}

export interface TikTokFuente {
  autor?: string | null
  caption?: string | null
  fechaVisible?: string | null
  finalUrl?: string | null
  hashtags: string[]
  metadatosConfirmados: string[]
  metricas?: TikTokMetricas
}

export interface ClawtokAnalysis {
  accionesSugeridas: string[]
  hechosConfirmados: string[]
  ideaPrincipal?: string | null
  inferencias: string[]
  herramientasMencionadas: string[]
  nivelConfianza?: 'alto' | 'medio' | 'bajo' | null
  senalesComentarios: string[]
}

export interface Nota {
  id: string
  tiktokUrl: string
  titulo: string
  carpetaId: string
  resumen: string
  glosario: GlosarioItem[]
  puntosClave: string[]
  utilidad: string
  comentariosDestilados: string[]
  etiquetas: string[]
  creadoEn: string
  actualizadoEn: string
  estadoProcesado: ProcessingStatus
  miniatura?: string
  transcriptParcial?: string
  notaPersonal?: string
  analisis?: ClawtokAnalysis
  analisisParcial?: boolean
  comentariosMuestra?: TikTokComentario[]
  fuente?: TikTokFuente
}

export interface ImportEstimate {
  atascada: boolean
  calculadoEn: string
  colaDelante: number
  duracionVideoSegundos?: number | null
  duracionVideoVisible?: string | null
  etapa: string
  etapaLabel: string
  listoEntre: {
    desde: string
    hasta: string
    desdeLocal: string
    hastaLocal: string
  }
  mensaje: string
  minutosRestantes: {
    maximo: number
    minimo: number
  }
  provisional: boolean
  sinActividadMinutos?: number | null
}

export interface ImportacionReciente {
  estimacion?: ImportEstimate
  id: string
  notaId?: string
  actualizadoEn?: string
  creadoEn: string
  error?: string | null
  estado: ProcessingStatus
  parcial?: boolean
  stage?: string | null
  url: string
}

export interface AppSnapshot {
  carpetas: Carpeta[]
  importaciones: ImportacionReciente[]
  notas: Nota[]
}

export interface AgentSnapshot {
  carpetas: Carpeta[]
  notasEnProceso: ImportacionReciente[]
  notasRecientes: Nota[]
}
