import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Configuração do Swagger
const config = new DocumentBuilder()
    .setTitle('Productivity Maxing API')
    .setDescription('A API profissional para gerir Areas e Tasks')
    .setVersion('1.0')
    .addTag('User')
    .addTag('Area')
    .addTag('Task')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  
  // O Swagger vai ficar disponível na rota /api
  SwaggerModule.setup('api', app, document);

  // O NestJS arranca na porta 3000
  await app.listen(3000);
}
bootstrap();