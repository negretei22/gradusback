import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FinanzasService } from './finanzas.service';
import { CategoriaFinanciera } from './categorias_financieras.entity';
import { MetodoPago } from './metodos_pago.entity';
import { MovimientoFinanciero } from './movimientos_financieros.entity';

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

    @Get('metodos_pago')
    getMetodosPago(): Promise<MetodoPago[]> {
        return this.finanzasService.getMetodosPago();
    }

    @Get('saldo/:anio/:mes')
    async getSaldo(@Param('anio') anio: number,@Param('mes') mes: number): Promise<{ saldo: number }> {
        return await this.finanzasService.getSaldo(anio,mes);
    }

    @Post('save')
    async guardaMovimiento(@Body() payload: any) {
        console.log(payload)
        return await this.finanzasService.guardaMovimiento(payload)
    }

    @Post('update/:id')
    async updateMovimiento(@Param('id') id: number, @Body() payload: any) {
        return await this.finanzasService.updateMovimiento(id, payload)
    }

    @Get('movimiento/:id')
    getMovimiento(@Param('id') id: number) {
        return this.finanzasService.getMovimiento(id);
    }


}
