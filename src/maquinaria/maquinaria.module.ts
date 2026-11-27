import { Module } from '@nestjs/common';
import { MaquinariaController } from './maquinaria.controller';
import { MaquinariaService } from './maquinaria.service';
import { GoogleSheetsService } from './google-sheets.service';
import { Marcas } from './marcas.entity';
import { Modelos } from './modelos.entity';
import { ArrendadoresMaquinaria } from './arrendadores_maquinaria.entity';
import { Maquinaria } from './maquinaria.entity';
import { TiposMaquinaria } from './tipos-maquinaria.entity';
import { TypeOrmModule } from '@nestjs/typeorm';


@Module({
  imports: [
    TypeOrmModule.forFeature([Marcas, Modelos,ArrendadoresMaquinaria, Maquinaria, TiposMaquinaria])
  ],
  controllers: [MaquinariaController],
  providers: [MaquinariaService, GoogleSheetsService]
})
export class MaquinariaModule {}
