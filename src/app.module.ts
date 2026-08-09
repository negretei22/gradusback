import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

// Entities
import { User } from './users/user.entity';
import { Role } from './roles/role.entity';
import { Licitacion } from './licitaciones/licitaciones.entity';
import { Contrato } from './contratos/contrato.entity';
import { CategoriaContrato } from './contratos/categorias_contrato.entity';
import { Estados } from './contratos/estados.entity';
import { Municipios } from './contratos/municipios.entity';
import { Colonias } from './contratos/colonias.entity';
import { EmpresasParticipantes } from './contratos/empresas_participantes';
import { Contratantes } from './contratos/contratantes.entity';
import { Marcas } from './maquinaria/marcas.entity';
import { Modelos } from './maquinaria/modelos.entity';
import { ArrendadoresMaquinaria } from './maquinaria/arrendadores_maquinaria.entity';
import { Maquinaria } from './maquinaria/maquinaria.entity';
import { MovimientoFinanciero } from './finanzas/movimientos_financieros.entity';
import { CategoriaFinanciera } from './finanzas/categorias_financieras.entity';
import { MetodoPago } from './finanzas/metodos_pago.entity';
import { Procedimiento } from './procedimientos/procedimientos.entity';
import { MovimientoCajaChica } from './caja-chica/movimientos_caja_chica.entity';

// Modules
import { UsersModule } from './users/users.module';
import { ContratosModule } from './contratos/contratos.module';
import { LicitacionesModule } from './licitaciones/licitaciones.module';
import { MaquinariaModule } from './maquinaria/maquinaria.module';
import { FinanzasModule } from './finanzas/finanzas.module';
import { ProcedimientosModule } from './procedimientos/procedimientos.module';
import { CajaChicaModule } from './caja-chica/caja-chica.module';
import { AuthModule } from './auth/auth.module';


// Guards






import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'vodmx-db.mysql.database.azure.com',
      port: 3306,
      username: 'iv0@vodmx-db',
      password: '*N36r3t3',
      database: 'gradus',
      entities: [
        User, Role, Licitacion, Contrato, CategoriaContrato, Estados,
        Municipios, Colonias, EmpresasParticipantes, Contratantes,
        Marcas, Modelos, ArrendadoresMaquinaria, Maquinaria,
        MovimientoFinanciero, CategoriaFinanciera, MetodoPago,
        Procedimiento, MovimientoCajaChica
      ],
      synchronize: true,
    }),
    UsersModule,
    ContratosModule,
    LicitacionesModule,
    MaquinariaModule,
    FinanzasModule,
    ProcedimientosModule,
    CajaChicaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [

    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    AppService,
    // 👇 GUARDS GLOBALES: protegen TODAS las rutas por defecto
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}