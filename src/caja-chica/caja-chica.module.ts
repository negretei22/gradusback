import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CajaChicaService } from './caja_chica.service';
import { MovimientoCajaChica } from './movimientos_caja_chica.entity';
import { CajaChicaController } from './caja-chica.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MovimientoCajaChica])],
  controllers: [CajaChicaController],
  providers: [CajaChicaService],
})
export class CajaChicaModule { }