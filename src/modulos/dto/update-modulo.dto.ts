import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class UpdateModuloDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  ruta?: string;

  @IsOptional()
  @IsString()
  icono?: string;

  @IsOptional()
  @IsObject()
  permisos?: Record<string, string[]>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}