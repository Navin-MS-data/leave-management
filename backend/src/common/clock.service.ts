import { Injectable } from '@nestjs/common';
import { todayISO } from './dates';

/** Source of "today". Tests set `fixed` to make date-dependent rules deterministic. */
@Injectable()
export class ClockService {
  fixed?: string;

  today(): string {
    return this.fixed ?? todayISO();
  }
}
