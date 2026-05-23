import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InstallmentReminderTask } from '../src/notifications/installment-reminder.task';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const task = app.get(InstallmentReminderTask);
    const result = await task.triggerReminders();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
