import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobroRecurrente } from './cobro-recurrente.entity';
import { CobroRecurrenteFactura } from './cobro-recurrente-factura.entity';
import { CobroRecurrentePago } from './cobro-recurrente-pago.entity';
import { CobroRecurrenteSeleccion } from './cobro-recurrente-seleccion.entity';
import { MovimientoFinanciero } from '../finanzas/movimientos_financieros.entity';
import { CobrosRecurrentesService } from './cobros-recurrentes.service';
import { CobrosRecurrentesController } from './cobros-recurrentes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CobroRecurrente, CobroRecurrenteFactura, CobroRecurrentePago, CobroRecurrenteSeleccion, MovimientoFinanciero])],
  controllers: [CobrosRecurrentesController],
  providers: [CobrosRecurrentesService],
})
export class CobrosRecurrentesModule {}
