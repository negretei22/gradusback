import { Module } from '@nestjs/common';
import { CajaChicaModule } from '../caja-chica/caja-chica.module';
import { MaquinariaModule } from '../maquinaria/maquinaria.module';
import { BancosCajaChicaController } from './bancos-caja-chica.controller';
import { BancosCajaChicaService } from './bancos.caja-chica.service';

@Module({
  imports: [
    CajaChicaModule,
    // Para escribir la hoja de Saldos en Drive (GoogleSheetsService).
    MaquinariaModule,
  ],
  controllers: [BancosCajaChicaController],
  providers: [BancosCajaChicaService],
  // Finanzas lo usa para refrescar la hoja de Saldos al guardar una
  // factura de banco (sin ciclos: Bancos no importa Finanzas).
  exports: [BancosCajaChicaService],
})
export class BancosCajaChicaModule {}