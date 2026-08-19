export interface DatabaseDumper {
  dump(rutaDestino: string): Promise<void>
}

export interface CloudBackupInfo {
  nombre: string
  fecha: Date
  tamano: number
}

export interface CloudBackupStorage {
  subir(archivo: string, nombre: string): Promise<void>
  listar(): Promise<CloudBackupInfo[]>
  borrar(nombre: string): Promise<void>
}