import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicioService } from './servicios.service';
import { ServicioController } from './servicios.controller';
import { Servicio } from './servicio.entity';
import { MaquinariaModule } from 'src/maquinaria/maquinaria.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([Servicio]),
    // Para refrescar el archivo de Servicios en Drive al guardar un
    // servicio (sin ciclos: Maquinaria no importa Servicios).
    MaquinariaModule,
  ],
  controllers: [ServicioController],
  providers: [ServicioService],
})
export class ServicioModule {}