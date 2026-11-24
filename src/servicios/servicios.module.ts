import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicioService } from './servicios.service';
import { ServicioController } from './servicios.controller';
import { Servicio } from './servicio.entity';
import { TipoServicio } from './tipo-servicio.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Servicio, TipoServicio])],
  controllers: [ServicioController],
  providers: [ServicioService],
})
export class ServicioModule {}