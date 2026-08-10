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
import { renameSync } from 'fs';
import { join, extname } from 'path';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/shared/enums/user-role.enum';

const storageFinanzas = diskStorage({
  destination: './uploads/movimientos',
  filename: (req, file, callback) => {
    const nombreCorrecto = Buffer.from(file.originalname, 'latin1').toString('utf8');
    callback(null, nombreCorrecto);
  },
});

const LABELS = [
  { key: 'factura', label: 'Factura' },
  { key: 'pago', label: 'Comprobante de Pago' },
];

async function renombrarArchivos(
  files: { [key: string]: Express.Multer.File[] },
  payload: any,
  labels: { key: string; label: string }[],
  conteosIniciales: { [campo: string]: number },
) {
  const resultado: { [key: string]: string } = {};

  const fechaBase =
    payload.fecha_factura && payload.fecha_factura !== '0000-00-00'
      ? payload.fecha_factura
      : payload.fecha_pago;

  const fecha = new Date(fechaBase);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');

  const rfcLimpio = (payload.rfc || 'SIN_RFC').replace(/[^a-zA-Z0-9-_]/g, '');

  labels.forEach(({ key, label }) => {
    const campo = `archivo_${key}`;
    const archivosCampo = files?.[campo];
    if (!archivosCampo || !archivosCampo.length) return;

    const nombresFinales: string[] = [];
    let contador = conteosIniciales[campo] || 0;

    archivosCampo.forEach((archivo) => {
      try {
        contador++;
        const ext = extname(archivo.originalname);
        const nuevoNombre = `${anio}-${mes}-${rfcLimpio}-${label} ${contador}${ext}`;

        const rutaVieja = join('./uploads/movimientos', archivo.filename);
        const rutaNueva = join('./uploads/movimientos', nuevoNombre);

        console.log('Renombrando:', rutaVieja, '->', rutaNueva);

        renameSync(rutaVieja, rutaNueva);
        nombresFinales.push(nuevoNombre);
      } catch (err) {
        console.error(`Error renombrando ${campo}:`, err);
        nombresFinales.push(archivo.filename);
      }
    });

    resultado[campo] = nombresFinales.join(',');
  });

  return resultado;
}

const archivosInterceptor = FileFieldsInterceptor(
  [
    { name: 'archivo_factura', maxCount: 10 },
    { name: 'archivo_pago', maxCount: 10 },
  ],
  { storage: storageFinanzas },
);

@Controller('finanzas')
export class FinanzasController {
  constructor(private readonly finanzasService: FinanzasService) {}

  // ============================================
  // 📖 CONSULTAS — Cualquier usuario logueado
  // ============================================

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
  buscarConceptosPorRfc(
    @Query('rfc') rfc: string,
    @Query('texto') texto: string,
  ) {
    return this.finanzasService.buscarConceptosPorRfc(rfc, texto);
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

  // ============================================
  // ✏️ ESCRITURA — Solo Admin
  // ============================================

  @Roles(UserRole.ADMIN)
  @Post('save')
  @UseInterceptors(archivosInterceptor)
  async guardaMovimiento(
    @UploadedFiles() files: { [key: string]: Express.Multer.File[] },
    @Body() payload: any,
  ) {
    const conteosIniciales: { [campo: string]: number } = {};
    for (const { key } of LABELS) {
      const campo = `archivo_${key}`;
      conteosIniciales[campo] =
        await this.finanzasService.contarArchivosPorRfcYTipo(payload.rfc, campo);
    }

    const renombrados = await renombrarArchivos(
      files,
      payload,
      LABELS,
      conteosIniciales,
    );
    Object.assign(payload, renombrados);

    return await this.finanzasService.guardaMovimiento(payload);
  }

  @Roles(UserRole.ADMIN)
  @Post('update/:id')
  @UseInterceptors(archivosInterceptor)
  async updateMovimiento(
    @Param('id') id: number,
    @UploadedFiles() files: { [key: string]: Express.Multer.File[] },
    @Body() payload: any,
  ) {
    const conteosIniciales: { [campo: string]: number } = {};
    for (const { key } of LABELS) {
      const campo = `archivo_${key}`;
      conteosIniciales[campo] =
        await this.finanzasService.contarArchivosPorRfcYTipo(payload.rfc, campo);
    }

    const renombrados = await renombrarArchivos(
      files,
      payload,
      LABELS,
      conteosIniciales,
    );
    Object.assign(payload, renombrados);

    return await this.finanzasService.updateMovimiento(id, payload);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  deleteMovimiento(@Param('id') id: number) {
    return this.finanzasService.deleteMovimiento(Number(id));
  }

  @Roles(UserRole.ADMIN)
  @Post('update_orden')
  updateOrden(@Body('id') id: number, @Body('orden') orden: number) {
    return this.finanzasService.updateOrden(id, orden);
  }

  @Roles(UserRole.ADMIN)
  @Post('movimientos/orden-masivo')
  async actualizarOrdenMasivo(
    @Body() body: { items: { id: number; orden: number }[] },
  ) {
    return this.finanzasService.actualizarOrdenMasivo(body.items);
  }
}