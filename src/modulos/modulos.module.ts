import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModulosService } from './modulos.service';
import { ModulosController } from './modulos.controller';
import { Modulo } from './modulos.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Modulo])],
  providers: [ModulosService],
  controllers: [ModulosController],
  exports: [ModulosService],
})
export class ModulosModule {}