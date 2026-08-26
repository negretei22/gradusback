import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicioService } from './servicios.service';
import { ServicioController } from './servicios.controller';
import { Servicio } from './servicio.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Servicio])],
  controllers: [ServicioController],
  providers: [ServicioService],
})
export class ServicioModule {}