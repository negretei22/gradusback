import { Module } from '@nestjs/common';
import { MaquinariaController } from './maquinaria.controller';
import { MaquinariaService } from './maquinaria.service';
import { Marcas } from './marcas.entity';
import { Modelos } from './modelos.entity';
import { ArrendadoresMaquinaria } from './arrendadores_maquinaria.entity';
import { Maquinaria } from './maquinaria.entity';
import { TypeOrmModule } from '@nestjs/typeorm';


@Module({
  imports: [
    TypeOrmModule.forFeature([Marcas, Modelos,ArrendadoresMaquinaria, Maquinaria])
  ],
  controllers: [MaquinariaController],
  providers: [MaquinariaService]
})
export class MaquinariaModule {}
