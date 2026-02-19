import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FinanzasService } from './finanzas.service';
import { CategoriaFinanciera } from './categorias_financieras.entity';
import { MetodoPago } from './metodos_pago.entity';
import { MovimientoFinanciero } from './movimientos_financieros.entity';

@Controller('finanzas')
export class FinanzasController {

    constructor(private readonly finanzasService: FinanzasService) { }

    @Get()
    findContratos() {
        return this.finanzasService.findMovimientos();
    }

    @Get('categorias')
    getMarcas(): Promise<CategoriaFinanciera[]> {
        return this.finanzasService.getCategorias();
    }

    @Get('metodos_pago')
    getMetodosPago(): Promise<MetodoPago[]> {
        return this.finanzasService.getMetodosPago();
    }

     @Get('saldo')
    getSaldo(): Promise<{ saldo: number }> {
        return this.finanzasService.getSaldo();
    }

    @Post('save')
    async guardaMovimiento(@Body() payload: any) {
        console.log(payload)
        return await this.finanzasService.guardaMovimiento(payload)
    }

    @Post('update/:id')
    async updateMovimiento(@Param('id') id: number,@Body() payload: any) {
        return await this.finanzasService.updateMovimiento(id,payload)
    }

    @Get('movimiento/:id')
    getMovimiento(@Param('id') id: number) {
    return this.finanzasService.getMovimiento(id);
    }


}
