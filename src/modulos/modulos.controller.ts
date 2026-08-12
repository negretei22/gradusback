import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Req,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/shared/enums/user-role.enum';

@Controller('modulos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModulosController {
  constructor(private readonly modulosService: ModulosService) {}

  @Get()
  async getModulos(@Req() req) {
    const userRole = req.user.role;
    return this.modulosService.findByRole(userRole);
  }

  @Roles(UserRole.SUPERADMIN)
  @Get('all')
  async getAll() {
    return this.modulosService.findAll();
  }

  @Get('permisos/:ruta')
  async getPermisos(@Req() req, @Param('ruta') ruta: string) {
    const userRole = req.user.role;
    const rutaCompleta = ruta.startsWith('/') ? ruta : '/' + ruta;
    const modulo = await this.modulosService.findByRuta(rutaCompleta);

    if (!modulo) {
      return {
        permisos: [],
        puedeVer: false,
        puedeEditar: false,
        puedeEliminar: false,
      };
    }

    const permisos = modulo.permisos?.[userRole] || [];

    return {
      ruta: modulo.ruta,
      nombre: modulo.nombre,
      rol: userRole,
      permisos: permisos,
      puedeVer: permisos.includes('ver'),
      puedeEditar: permisos.includes('editar'),
      puedeEliminar: permisos.includes('eliminar'),
    };
  }

  @Roles(UserRole.SUPERADMIN)
  @Post()
  async create(@Body() dto: any) {
    return this.modulosService.create(dto);
  }

  @Roles(UserRole.SUPERADMIN)
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.modulosService.update(id, dto);
  }

  @Roles(UserRole.SUPERADMIN)
  @Put(':id/permisos')
  async updatePermisos(
    @Param('id') id: string,
    @Body('permisos') permisos: Record<string, string[]>,
  ) {
    return this.modulosService.updatePermisos(id, permisos);
  }

  @Roles(UserRole.SUPERADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.modulosService.remove(id);
  }
}