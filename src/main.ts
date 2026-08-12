import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ModulosService } from './modulos/modulos.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: 'http://localhost:4200',
    credentials: true,
  });

  // 👇 SEED: Inserta los módulos si la tabla está vacía
  const modulosService = app.get(ModulosService);
  console.log('✅ Módulos verificados/cargados');

  await app.listen(3000);
  console.log('🚀 Backend corriendo en http://localhost:3000');
}
bootstrap();