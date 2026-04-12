import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const envCandidates = [join(process.cwd(), '.env'), join(process.cwd(), 'api', '.env')];
for (const path of envCandidates) {
  if (existsSync(path)) {
    loadEnv({ path });
    break;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
bootstrap();
