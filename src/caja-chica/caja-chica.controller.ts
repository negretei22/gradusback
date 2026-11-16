import { Controller, Get, Param, Query } from '@nestjs/common';
import { CajaChicaService } from './caja_chica.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('caja-chica')
export class CajaChicaController {
  constructor(private readonly cajaChicaService: CajaChicaService) { }

  @Get()
  findMovimientos(@Query('anio') anio?: string, @Query('mes') mes?: string) {
    return this.cajaChicaService.findMovimientos(anio, mes);
  }

  @Get('saldo/:anio/:mes')
  getSaldo(@Param('anio') anio: number, @Param('mes') mes: number) {
    return this.cajaChicaService.getSaldo(anio, mes);
  }

  @Get('movimiento-financiero/:id')
  getMovimientoFinanciero(@Param('id') id: number) {
    return this.cajaChicaService.getMovimientoFinanciero(id);
  }

  // Diagnóstico temporal: qué devuelve Google al leer cada hoja (caja y bancos).
  // Público para poder abrirlo directo en el navegador sin token.
  @Public()
  @Get('debug-sheet')
  debugSheet() {
    return this.cajaChicaService.debugSheet();
  }

  @Get('movimiento/:id')
  getMovimiento(@Param('id') id: number) {
    return this.cajaChicaService.getMovimiento(id);
  }
}