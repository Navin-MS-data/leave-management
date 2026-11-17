import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [SettingsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
