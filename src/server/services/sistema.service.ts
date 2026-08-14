import type { HorarioDisponibilidad } from '@/server/domain/constants'
import {
  HORARIO_DEFAULT,
  HORARIO_KEY,
  estaDentroDelHorario,
  horarioEnTexto,
  validarHorario,
} from '@/server/domain/horario'
import type { Repos } from '@/server/repo/interface'

export class SistemaService {
  constructor(private readonly repos: Repos) {}

  async obtenerHorario(): Promise<HorarioDisponibilidad> {
    const valor = await this.repos.settings.get(HORARIO_KEY)
    if (!valor) return { ...HORARIO_DEFAULT }
    try {
      const parsed = JSON.parse(valor) as HorarioDisponibilidad
      return { ...HORARIO_DEFAULT, ...parsed }
    } catch {
      return { ...HORARIO_DEFAULT }
    }
  }

  async guardarHorario(datos: HorarioDisponibilidad): Promise<void> {
    validarHorario(datos)
    await this.repos.settings.set(HORARIO_KEY, JSON.stringify(datos))
  }

  async estaDisponible(ahora = new Date()): Promise<boolean> {
    const horario = await this.obtenerHorario()
    return estaDentroDelHorario(horario, ahora)
  }

  async mensajeHorario(): Promise<string> {
    const h = await this.obtenerHorario()
    const texto = horarioEnTexto(h)
    return texto
      ? `El sistema está disponible de ${texto}.`
      : 'El sistema está fuera de su horario de disponibilidad.'
  }
}
