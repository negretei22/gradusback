import { Module } from '@nestjs/common';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import { Contrato } from './contrato.entity';
import { CategoriaContrato } from './categorias_contrato.entity';
import { Estados } from './estados.entity';
import { Municipios } from './municipios.entity';
import { Colonias } from './colonias.entity';
import { EmpresasParticipantes } from './empresas_participantes';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { Contratantes } from './contratantes.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contrato, CategoriaContrato, Estados, Municipios, Colonias, EmpresasParticipantes, Contratantes])],
  controllers: [ContratosController],
  providers: [ContratosService]
})
export class ContratosModule {}
