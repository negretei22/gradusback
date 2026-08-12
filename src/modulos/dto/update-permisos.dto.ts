import { IsObject } from 'class-validator';

export class UpdatePermisosDto {
  @IsObject()
  permisos!: Record<string, string[]>;  // 👈 Agrega el !
}