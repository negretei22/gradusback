import { Module } from '@nestjs/common';
import { ConciliacionController } from './conciliacion.controller';
import { ConciliacionService } from './conciliacion.service';

@Module({
  controllers: [ConciliacionController],
  providers: [ConciliacionService],
})
export class ConciliacionModule {}