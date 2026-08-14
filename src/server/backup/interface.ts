export interface DatabaseDumper {
  dump(rutaDestino: string): Promise<void>
}

export interface CloudBackupStorage {
  subir(archivo: string, nombre: string): Promise<void>
}