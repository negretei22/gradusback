import { Module } from '@nestjs/common';
import { CajaChicaModule } from '../caja-chica/caja-chica.module';
import { BancosCajaChicaController } from './bancos-caja-chica.controller';
import { BancosCajaChicaService } from './bancos.caja-chica.service';

@Module({
  imports: [CajaChicaModule],
  controllers: [BancosCajaChicaController],
  providers: [BancosCajaChicaService],
})
export class BancosCajaChicaModule {}