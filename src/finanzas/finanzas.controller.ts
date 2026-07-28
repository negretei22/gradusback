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
    { key: 'factura', label: 'Factura' },
    { key: 'pago', label: 'Comprobante de Pago' },
];





async function renombrarArchivos(
    files: { [key: string]: Express.Multer.File[] },
    payload: any,
    labels: { key: string, label: string }[],
    conteosIniciales: { [campo: string]: number }
) {
    const resultado: { [key: string]: string } = {};

    const fechaBase = payload.fecha_factura && payload.fecha_factura !== '0000-00-00'
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




const archivosInterceptor = FileFieldsInterceptor([
    { name: 'archivo_factura', maxCount: 10 },
    { name: 'archivo_pago', maxCount: 10 },
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

    @Get('movimientos/buscar-razon-social')
    buscarPorRazonSocial(@Query('texto') texto: string): Promise<MovimientoFinanciero[]> {
        return this.finanzasService.buscarPorRazonSocial(texto);
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
        const conteosIniciales: { [campo: string]: number } = {};
        for (const { key } of LABELS) {
            const campo = `archivo_${key}`;
            conteosIniciales[campo] = await this.finanzasService.contarArchivosPorRfcYTipo(payload.rfc, campo);
        }

        const renombrados = await renombrarArchivos(files, payload, LABELS, conteosIniciales);
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
        const conteosIniciales: { [campo: string]: number } = {};
        for (const { key } of LABELS) {
            const campo = `archivo_${key}`;
            conteosIniciales[campo] = await this.finanzasService.contarArchivosPorRfcYTipo(payload.rfc, campo);
        }

        const renombrados = await renombrarArchivos(files, payload, LABELS, conteosIniciales);
        Object.assign(payload, renombrados);

        return await this.finanzasService.updateMovimiento(id, payload);
    }


    @Get('movimiento/:id')
    getMovimiento(@Param('id') id: number) {
        return this.finanzasService.getMovimiento(id);
    }
}