import { Controller, Get, Req, UnauthorizedException, Param } from '@nestjs/common';
import { ModulosService } from './modulos.service';

@Controller('modulos')
export class ModulosController {
    constructor(private modulosService: ModulosService) { }

    @Get()
    async getModulos(@Req() req) {
        const userRole = req.user.role;
        return this.modulosService.findByRole(userRole);
    }

    @Get('all')
    async getAll() {
        return this.modulosService.findAll();
    }

    @Get('permisos/:ruta')
    async getPermisos(@Req() req, @Param('ruta') ruta: string) {
        const userRole = req.user.role;
        // 👇 Arreglado: si la ruta no empieza con /, se la agregamos
        const rutaCompleta = ruta.startsWith('/') ? ruta : '/' + ruta;
        const modulo = await this.modulosService.findByRuta(rutaCompleta);

        if (!modulo) {
            return { permisos: [], puedeVer: false, puedeEditar: false, puedeEliminar: false };
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

}