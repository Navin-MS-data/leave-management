import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../common/auth.decorators';
import { AuthUser } from '../common/types';
import { BalancesService } from './balances.service';

@Controller('balances')
export class BalancesController {
  constructor(private balances: BalancesService) {}

  @Get('me')
  @Roles('employee', 'manager')
  me(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    return this.balances.forUser(user, user.id, this.balances.resolveYear(year));
  }

  @Get('team')
  @Roles('manager', 'admin')
  team(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    return this.balances.forTeam(user, this.balances.resolveYear(year));
  }

  /** Own balance, a direct report's balance (manager), or anyone's (admin). */
  @Get(':userId')
  user(@CurrentUser() actor: AuthUser, @Param('userId', ParseIntPipe) userId: number, @Query('year') year?: string) {
    return this.balances.forUser(actor, userId, this.balances.resolveYear(year));
  }
}
