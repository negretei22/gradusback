import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FinanzasService } from './finanzas.service';
import { CategoriaFinanciera } from './categorias_financieras.entity';
import { MetodoPago } from './metodos_pago.entity';
import { MovimientoFinanciero } from './movimientos_financieros.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Express } from 'express';

const storage = diskStorage({
  destination: './uploads/movimientos',
  filename: (req, file, callback) => {
    callback(null, file.originalname);
  }
});

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

    @Get('razon_social/:rfc')
    getRazonSocial(@Param('rfc') rfc: number): Promise<MovimientoFinanciero[]> {
        return this.finanzasService.getRazonSocial(rfc);
    }

    @Get('metodos_pago')
    getMetodosPago(): Promise<MetodoPago[]> {
        return this.finanzasService.getMetodosPago();
    }

    @Get('saldo/:anio/:mes')
    async getSaldo(@Param('anio') anio: number, @Param('mes') mes: number): Promise<{ saldo: number }> {
        return await this.finanzasService.getSaldo(anio, mes);
    }

    @Post('save')
    @UseInterceptors(FileInterceptor('archivo', { storage }))

    async guardaMovimiento(
        @UploadedFile() file: Express.Multer.File,
        @Body() payload: any
    ) {
        console.log("BODY:", payload);
        console.log("FILE:", file);

        if (file) {
            payload.archivo = file.filename;
        }

        return await this.finanzasService.guardaMovimiento(payload);

    }

    @Post('update/:id')
    @UseInterceptors(FileInterceptor('archivo', { storage }))
    async updateMovimiento(
        @Param('id') id: number,
        @UploadedFile() file: Express.Multer.File,
        @Body() payload: any
    ) {

        console.log("BODY:", payload);
        console.log("FILE:", file);

        if (file) {
            payload.archivo = file.filename;
        }

        return await this.finanzasService.updateMovimiento(id, payload);
    }

    @Get('movimiento/:id')
    getMovimiento(@Param('id') id: number) {
        return this.finanzasService.getMovimiento(id);
    }


}
