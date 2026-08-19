import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  Delete,
} from '@nestjs/common';
import { FinanzasService } from './finanzas.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Express } from 'express';
import { extname } from 'path';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/shared/enums/user-role.enum';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

// Guarda archivos con nombre temporal para evitar colisiones
const storageFinanzas = diskStorage({
  destination: './uploads/movimientos',
  filename: (req, file, callback) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = extname(file.originalname);
    callback(null, `${unique}${ext}`);
  },
});

const archivosInterceptor = FileFieldsInterceptor(
  [
    { name: 'archivo_factura', maxCount: 10 },
    { name: 'archivo_pago', maxCount: 10 },
  ],
  { storage: storageFinanzas },
);

@Controller('finanzas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanzasController {
  constructor(private readonly finanzasService: FinanzasService) { }

  // ========== CONSULTAS ==========
  @Get()
  findMovimientos(@Query('anio') anio?: string, @Query('mes') mes?: string) {
    return this.finanzasService.findMovimientos(anio, mes);
  }

  @Get('categorias/:id')
  getCategorias(@Param('id') id_categoria: number) {
    return this.finanzasService.getCategorias(Number(id_categoria));
  }

  @Get('movimientos/buscar-razon-social')
  buscarPorRazonSocial(@Query('texto') texto: string) {
    return this.finanzasService.buscarPorRazonSocial(texto);
  }

  @Get('movimientos/buscar-conceptos')
  buscarConceptosPorRfc(@Query('rfc') rfc: string, @Query('texto') texto: string) {
    return this.finanzasService.buscarConceptosPorRfc(rfc, texto);
  }

  @Get('categoria/:categoriaId/tipo/:tipoId/anio/:anio/mes/:mes')
  getMovimientosPorCategoria(
    @Param('categoriaId') categoriaId: string,
    @Param('tipoId') tipoId: string,
    @Param('anio') anio: string,
    @Param('mes') mes: string,
  ) {
    return this.finanzasService.getMovimientosPorCategoria(
      Number(categoriaId),
      Number(tipoId),
      Number(anio),
      Number(mes),
    );
  }

  @Get('razon_social/:rfc')
  getRazonSocial(@Param('rfc') rfc: number) {
    return this.finanzasService.getRazonSocial(rfc);
  }

  @Get('metodos_pago')
  getMetodosPago() {
    return this.finanzasService.getMetodosPago();
  }

  @Get('saldo/:anio/:mes')
  async getSaldo(@Param('anio') anio: number, @Param('mes') mes: number) {
    return await this.finanzasService.getSaldo(anio, mes);
  }

  @Get('movimiento/:id')
  getMovimiento(@Param('id') id: number) {
    return this.finanzasService.getMovimiento(id);
  }

  // ========== ESCRITURA ==========
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @Post('save')
  @UseInterceptors(archivosInterceptor)
  async guardaMovimiento(
    @UploadedFiles() files: { [key: string]: Express.Multer.File[] },
    @Body() payload: any,
  ) {
    return await this.finanzasService.guardaMovimiento(payload, files);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @Post('update/:id')
  @UseInterceptors(archivosInterceptor)
  async updateMovimiento(
    @Param('id') id: number,
    @UploadedFiles() files: { [key: string]: Express.Multer.File[] },
    @Body() payload: any,
  ) {
    return await this.finanzasService.updateMovimiento(id, payload, files);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @Delete(':id')
  deleteMovimiento(@Param('id') id: number) {
    return this.finanzasService.deleteMovimiento(Number(id));
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @Post('update_orden')
  updateOrden(@Body('id') id: number, @Body('orden') orden: number) {
    return this.finanzasService.updateOrden(id, orden);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @Post('movimientos/orden-masivo')
  async actualizarOrdenMasivo(
    @Body() body: { items: { id: number; orden: number }[] },
  ) {
    return this.finanzasService.actualizarOrdenMasivo(body.items);
  }
}