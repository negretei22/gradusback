import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PagoRecurrente } from './pago-recurrente.entity';
import { PagoRecurrenteFactura } from './pago-recurrente-factura.entity';
import { MovimientoFinanciero } from '../finanzas/movimientos_financieros.entity';
import { PagosRecurrentesService } from './pagos-recurrentes.service';
import { PagosRecurrentesController } from './pagos-recurrentes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PagoRecurrente, PagoRecurrenteFactura, MovimientoFinanciero])],
  controllers: [PagosRecurrentesController],
  providers: [PagosRecurrentesService],
})
export class PagosRecurrentesModule {}
