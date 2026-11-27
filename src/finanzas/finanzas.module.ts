import { Module } from '@nestjs/common';
import { FinanzasController } from './finanzas.controller';
import { FinanzasService } from './finanzas.service';
import { MovimientoFinanciero } from './movimientos_financieros.entity';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { CategoriaFinanciera } from 'src/finanzas/categorias_financieras.entity';
import { MetodoPago } from './metodos_pago.entity';
import { MovimientoCajaChica } from 'src/caja-chica/movimientos_caja_chica.entity';
import { MovimientoFinancieroPago } from './movimiento-financiero-pago.entity';
import { DondeAplica } from './donde-aplica.entity';
import { MaquinariaModule } from 'src/maquinaria/maquinaria.module';


@Module({
   imports: [
      TypeOrmModule.forFeature([MovimientoFinanciero,CategoriaFinanciera,MetodoPago,MovimientoCajaChica,MovimientoFinancieroPago,DondeAplica]),
      // Para refrescar el archivo de Leasing en Drive al capturar una
      // factura ligada a un activo (sin ciclos: Maquinaria no importa Finanzas).
      MaquinariaModule,
    ],
  controllers: [FinanzasController],
  providers: [FinanzasService]
})
export class FinanzasModule {}
