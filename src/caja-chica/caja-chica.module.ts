import { Module } from '@nestjs/common';
import { CajaChicaController } from './caja-chica.controller';
import { CajaChicaService } from './caja_chica.service';

@Module({
  controllers: [CajaChicaController],
  providers: [CajaChicaService],
})
export class CajaChicaModule {}