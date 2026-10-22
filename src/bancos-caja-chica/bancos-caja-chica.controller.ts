import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { BancosCajaChicaService } from './bancos.caja-chica.service';

@Controller('bancos-caja-chica')
export class BancosCajaChicaController {
    constructor(private readonly service: BancosCajaChicaService) { }

    @Get(':anio/:mes')
    getMes(@Param('anio') anio: number, @Param('mes') mes: number) {
        return this.service.getMes(anio, mes);
    }

    @Post('saldo/:anio/:mes')
    guardarSaldo(@Param('anio') anio: number, @Param('mes') mes: number, @Body() body: any) {
        return this.service.guardarSaldo(anio, mes, body);
    }

    @Post('cerrar/:anio/:mes')
    cerrarMes(@Param('anio') anio: number, @Param('mes') mes: number) {
        return this.service.cerrarMes(anio, mes);
    }
}