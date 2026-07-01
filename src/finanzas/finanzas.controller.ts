import { Body, Controller, Get, Param, Post, Query, UploadedFiles, UseInterceptors, Delete } from '@nestjs/common';
import { FinanzasService } from './finanzas.service';
import { CategoriaFinanciera } from './categorias_financieras.entity';
import { MetodoPago } from './metodos_pago.entity';
import { MovimientoFinanciero } from './movimientos_financieros.entity';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Express } from 'express';
import { renameSync } from 'fs';
import { join } from 'path';
import { extname } from 'path';


const storage = diskStorage({
    destination: './uploads/movimientos',
    filename: (req, file, callback) => {
        const nombreTemporal = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
        callback(null, nombreTemporal);
    }
});

const LABELS = [
    { key: 'prefactura', label: 'Prefactura' },
    { key: 'factura', label: 'Factura' },
    { key: 'nota_pago', label: 'Nota de Pago' },
    { key: 'pago', label: 'Pago' },
    { key: 'otra', label: 'Otra' },
];

function renombrarArchivos(
    files: { [key: string]: Express.Multer.File[] },
    folioFiscal: string,
    labels: { key: string, label: string }[]
) {
    const resultado: { [key: string]: string } = {};

    labels.forEach(({ key, label }) => {
        const campo = `archivo_${key}`;
        const archivo = files?.[campo]?.[0];
        if (archivo) {
            try {
                const ext = extname(archivo.originalname);
                const folioLimpio = (folioFiscal || 'SIN_FOLIO').replace(/[^a-zA-Z0-9-_]/g, '');
                const nuevoNombre = `${folioLimpio} - ${label}${ext}`;

                const rutaVieja = join('./uploads/movimientos', archivo.filename);
                const rutaNueva = join('./uploads/movimientos', nuevoNombre);

                console.log('Renombrando:', rutaVieja, '->', rutaNueva);

                renameSync(rutaVieja, rutaNueva);
                resultado[campo] = nuevoNombre;
            } catch (err) {
                console.error(`Error renombrando ${campo}:`, err);
                // fallback: al menos guarda el nombre original que Multer sí subió
                resultado[campo] = archivo.filename;
            }
        }
    });

    return resultado;
}

const archivosInterceptor = FileFieldsInterceptor([
    { name: 'archivo_prefactura', maxCount: 1 },
    { name: 'archivo_factura', maxCount: 1 },
    { name: 'archivo_nota_pago', maxCount: 1 },
    { name: 'archivo_pago', maxCount: 1 },
    { name: 'archivo_otra', maxCount: 1 },
], { storage });

@Controller('finanzas')
export class FinanzasController {

    constructor(private readonly finanzasService: FinanzasService) { }

    @Get()
    findMovimientos(@Query('anio') anio?: string, @Query('mes') mes?: string) {
        return this.finanzasService.findMovimientos(anio, mes);
    }

    @Get('categorias/:id')
    getCategorias(@Param('id') id_categoria: number): Promise<CategoriaFinanciera[]> {
        return this.finanzasService.getCategorias(Number(id_categoria));
    }

    @Delete(':id')
    deleteMovimiento(@Param('id') id: number) {
        return this.finanzasService.deleteMovimiento(Number(id));
    }

    @Get('razon_social/:rfc')
    getRazonSocial(@Param('rfc') rfc: number): Promise<MovimientoFinanciero[]> {
        return this.finanzasService.getRazonSocial(rfc);
    }

    @Get('metodos_pago')
    getMetodosPago(): Promise<MetodoPago[]> {
        return this.finanzasService.getMetodosPago();
    }

    @Post('update_orden')
    updateOrden(
        @Body('id') id: number,
        @Body('orden') orden: number
    ): Promise<any> {
        return this.finanzasService.updateOrden(id, orden);
    }

    @Get('saldo/:anio/:mes')
    async getSaldo(@Param('anio') anio: number, @Param('mes') mes: number): Promise<{ saldo: number }> {
        return await this.finanzasService.getSaldo(anio, mes);
    }

    @Post('save')
    @UseInterceptors(archivosInterceptor)
    async guardaMovimiento(
        @UploadedFiles() files: { [key: string]: Express.Multer.File[] },
        @Body() payload: any
    ) {
        const renombrados = renombrarArchivos(files, payload.folio_fiscal, LABELS);
        Object.assign(payload, renombrados);

        return await this.finanzasService.guardaMovimiento(payload);
    }


    @Post('update/:id')
    @UseInterceptors(archivosInterceptor)
    async updateMovimiento(
        @Param('id') id: number,
        @UploadedFiles() files: { [key: string]: Express.Multer.File[] },
        @Body() payload: any
    ) {
        const renombrados = renombrarArchivos(files, payload.folio_fiscal, LABELS);
        Object.assign(payload, renombrados);

        return await this.finanzasService.updateMovimiento(id, payload);
    }


    @Get('movimiento/:id')
    getMovimiento(@Param('id') id: number) {
        return this.finanzasService.getMovimiento(id);
    }
}