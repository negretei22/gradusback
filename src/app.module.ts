import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/user.entity';
import { Role } from './roles/role.entity';
import { Licitacion } from './licitaciones/licitaciones.entity';
import { Contrato } from './contratos/contrato.entity';
import { UsersModule } from './users/users.module';
import { ContratosModule } from './contratos/contratos.module';
import { LicitacionesModule } from './licitaciones/licitaciones.module';
import { CategoriaContrato } from './contratos/categorias_contrato.entity';
import { Estados } from './contratos/estados.entity';
import { Municipios } from './contratos/municipios.entity';
import { Colonias } from './contratos/colonias.entity';
import { EmpresasParticipantes } from './contratos/empresas_participantes';
import { Contratantes } from './contratos/contratantes.entity';
import { MaquinariaModule } from './maquinaria/maquinaria.module';
import { Marcas } from './maquinaria/marcas.entity';
import { Modelos } from './maquinaria/modelos.entity';
import { ArrendadoresMaquinaria } from './maquinaria/arrendadores_maquinaria.entity';
import { Maquinaria } from './maquinaria/maquinaria.entity';
import { MovimientoFinanciero } from './finanzas/movimientos_financieros.entity';
import { FinanzasModule } from './finanzas/finanzas.module';
import { CategoriaFinanciera } from './finanzas/categorias_financieras.entity';
import { MetodoPago } from './finanzas/metodos_pago.entity';



@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'vodmx-db.mysql.database.azure.com',
      port: 3306,
      username: 'iv0@vodmx-db',
      password: '*N36r3t3', // cambia
      database: 'gradus',
      entities: [User,
        Role,
        Licitacion,
        Contrato,
        CategoriaContrato,
        Estados,
        Municipios,
        Colonias,
        EmpresasParticipantes,
        Contratantes,
        Marcas,
        Modelos,
        ArrendadoresMaquinaria,
        Maquinaria,
        MovimientoFinanciero,
        CategoriaFinanciera,
        MetodoPago
      ],
      synchronize: true, // SOLO DEV
    }),
    UsersModule,
    ContratosModule,
    LicitacionesModule,
    MaquinariaModule,
    FinanzasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }


