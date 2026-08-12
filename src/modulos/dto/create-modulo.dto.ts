import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateModuloDto {
  @IsString()
  nombre: string;

  @IsString()
  ruta: string;

  @IsString()
  icono: string;

  @IsOptional()
  @IsObject()
  permisos?: Record<string, string[]>;
}