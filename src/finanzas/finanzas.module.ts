import { Module } from '@nestjs/common';
import { FinanzasController } from './finanzas.controller';
import { FinanzasService } from './finanzas.service';
import { MovimientoFinanciero } from './movimientos_financieros.entity';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { CategoriaFinanciera } from 'src/finanzas/categorias_financieras.entity';
import { MetodoPago } from './metodos_pago.entity';
import { MovimientoCajaChica } from 'src/caja-chica/movimientos_caja_chica.entity';


@Module({
   imports: [
      TypeOrmModule.forFeature([MovimientoFinanciero,CategoriaFinanciera,MetodoPago,MovimientoCajaChica])
    ],
  controllers: [FinanzasController],
  providers: [FinanzasService]
})
export class FinanzasModule {}
