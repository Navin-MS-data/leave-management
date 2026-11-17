import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule.register());
  configureApp(app);
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Leave management API listening on http://localhost:${port}`);
}

bootstrap();
