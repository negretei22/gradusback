import { Body, Controller, Get, Param, Post, Query, Delete } from '@nestjs/common';
import { CajaChicaService } from './caja_chica.service';

@Controller('caja-chica')
export class CajaChicaController {

  constructor(private readonly cajaChicaService: CajaChicaService) { }

  @Get()
  findMovimientos(@Query('anio') anio?: string, @Query('mes') mes?: string) {
    return this.cajaChicaService.findMovimientos(anio, mes);
  }

  @Get('saldo/:anio/:mes')
  async getSaldo(@Param('anio') anio: number, @Param('mes') mes: number) {
    return await this.cajaChicaService.getSaldo(anio, mes);
  }

  @Get('movimiento/:id')
  getMovimiento(@Param('id') id: number) {
    return this.cajaChicaService.getMovimiento(id);
  }

  @Post('save')
  async guardaMovimiento(@Body() payload: any) {
    return await this.cajaChicaService.guardaMovimiento(payload);
  }

  @Post('update/:id')
  async updateMovimiento(@Param('id') id: number, @Body() payload: any) {
    return await this.cajaChicaService.updateMovimiento(id, payload);
  }

  @Post('update_orden')
  updateOrden(
    @Body('id') id: number,
    @Body('orden') orden: number
  ): Promise<any> {
    return this.cajaChicaService.updateOrden(id, orden);
  }

  @Delete(':id')
  deleteMovimiento(@Param('id') id: number) {
    return this.cajaChicaService.deleteMovimiento(Number(id));
  }
}