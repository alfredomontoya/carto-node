import { describe, expect, it } from 'vitest'
import { createTestDb, limpiarTablas } from '@/db/test-db'

const tdb = createTestDb()
tdb.setEnv()

const { repos } = await import('@/server/repo')
const { SistemaService } = await import('@/server/services/sistema.service')

const sistema = new SistemaService(repos)

beforeEach(async () => {
  await limpiarTablas()
})

afterAll(() => tdb.cleanup())

describe('SistemaService — horario de disponibilidad', () => {
  it('sin configuración guardada el sistema está disponible (horario deshabilitado)', async () => {
    expect(await sistema.estaDisponible(new Date(2026, 7, 17, 12, 0))).toBe(true)
    expect(await sistema.obtenerHorario()).toEqual({
      habilitado: false,
      horaInicio: '07:00',
      horaFin: '19:00',
      dias: [1, 2, 3, 4, 5],
    })
  })

  it('respeta el rango horario configurado (inicio inclusivo, fin exclusivo)', async () => {
    await sistema.guardarHorario({ habilitado: true, horaInicio: '07:00', horaFin: '19:00', dias: [1, 2, 3, 4, 5] })
    // lunes 12:00 -> dentro
    expect(await sistema.estaDisponible(new Date(2026, 7, 17, 12, 0))).toBe(true)
    // lunes 07:00 -> dentro (inicio inclusivo)
    expect(await sistema.estaDisponible(new Date(2026, 7, 17, 7, 0))).toBe(true)
    // lunes 06:59 -> fuera
    expect(await sistema.estaDisponible(new Date(2026, 7, 17, 6, 59))).toBe(false)
    // lunes 19:00 -> fuera (fin exclusivo)
    expect(await sistema.estaDisponible(new Date(2026, 7, 17, 19, 0))).toBe(false)
    // sábado 12:00 -> fuera
    expect(await sistema.estaDisponible(new Date(2026, 7, 15, 12, 0))).toBe(false)
  })

  it('permite configurar días específicos', async () => {
    await sistema.guardarHorario({ habilitado: true, horaInicio: '08:00', horaFin: '12:00', dias: [2, 4] })
    // martes dentro
    expect(await sistema.estaDisponible(new Date(2026, 7, 18, 10, 0))).toBe(true)
    // jueves dentro
    expect(await sistema.estaDisponible(new Date(2026, 7, 20, 10, 0))).toBe(true)
    // lunes fuera
    expect(await sistema.estaDisponible(new Date(2026, 7, 17, 10, 0))).toBe(false)
  })

  it('al deshabilitar el horario el sistema queda siempre disponible', async () => {
    await sistema.guardarHorario({ habilitado: true, horaInicio: '08:00', horaFin: '12:00', dias: [1] })
    expect(await sistema.estaDisponible(new Date(2026, 7, 17, 23, 0))).toBe(false)
    await sistema.guardarHorario({ habilitado: false, horaInicio: '08:00', horaFin: '12:00', dias: [1] })
    expect(await sistema.estaDisponible(new Date(2026, 7, 17, 23, 0))).toBe(true)
  })

  it('rechaza horas inválidas o con fin no posterior al inicio', async () => {
    await expect(
      sistema.guardarHorario({ habilitado: true, horaInicio: '25:00', horaFin: '19:00', dias: [1] }),
    ).rejects.toThrow(/formato/i)
    await expect(
      sistema.guardarHorario({ habilitado: true, horaInicio: '19:00', horaFin: '07:00', dias: [1] }),
    ).rejects.toThrow(/fin/i)
    await expect(
      sistema.guardarHorario({ habilitado: true, horaInicio: '07:00', horaFin: '07:00', dias: [1] }),
    ).rejects.toThrow(/fin/i)
  })

  it('rechaza no seleccionar días', async () => {
    await expect(
      sistema.guardarHorario({ habilitado: true, horaInicio: '07:00', horaFin: '19:00', dias: [] }),
    ).rejects.toThrow(/d[ií]a/)
  })

  it('recupera la configuración guardada', async () => {
    await sistema.guardarHorario({ habilitado: true, horaInicio: '06:30', horaFin: '20:15', dias: [0, 6] })
    expect(await sistema.obtenerHorario()).toEqual({
      habilitado: true,
      horaInicio: '06:30',
      horaFin: '20:15',
      dias: [0, 6],
    })
  })
})
