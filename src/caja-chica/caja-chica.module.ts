import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CajaChicaController } from './caja_chica.controller';
import { CajaChicaService } from './caja_chica.service';
import { MovimientoCajaChica } from './movimientos_caja_chica.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MovimientoCajaChica])],
  controllers: [CajaChicaController],
  providers: [CajaChicaService],
})
export class CajaChicaModule { }