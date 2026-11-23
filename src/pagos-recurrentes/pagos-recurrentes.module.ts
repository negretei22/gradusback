import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PagoRecurrente } from './pago-recurrente.entity';
import { PagoRecurrenteFactura } from './pago-recurrente-factura.entity';
import { PagoRecurrentePago } from './pago-recurrente-pago.entity';
import { PagoRecurrenteSeleccion } from './pago-recurrente-seleccion.entity';
import { MovimientoFinanciero } from '../finanzas/movimientos_financieros.entity';
import { PagosRecurrentesService } from './pagos-recurrentes.service';
import { PagosRecurrentesController } from './pagos-recurrentes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PagoRecurrente, PagoRecurrenteFactura, PagoRecurrentePago, PagoRecurrenteSeleccion, MovimientoFinanciero])],
  controllers: [PagosRecurrentesController],
  providers: [PagosRecurrentesService],
})
export class PagosRecurrentesModule {}
