import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcedimientosService } from './procedimientos.service';
import { ProcedimientosController } from './procedimientos.controller';
import { Procedimiento } from './procedimientos.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Procedimiento])],
  controllers: [ProcedimientosController],
  providers: [ProcedimientosService],
})
export class ProcedimientosModule {}