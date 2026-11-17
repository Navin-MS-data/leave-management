import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/auth.decorators';
import { AuthUser } from '../common/types';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private calendar: CalendarService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.calendar.getCalendar(user, from, to);
  }
}
