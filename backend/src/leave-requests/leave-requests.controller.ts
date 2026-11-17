import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CurrentUser, Roles } from '../common/auth.decorators';
import { AuthUser } from '../common/types';
import { LeaveRequestsService } from './leave-requests.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLeaveRequestDto {
  @IsInt()
  leaveTypeId: number;

  @Matches(DATE_RE, { message: 'startDate must be in YYYY-MM-DD format' })
  startDate: string;

  @Matches(DATE_RE, { message: 'endDate must be in YYYY-MM-DD format' })
  endDate: string;

  @IsString()
  @IsNotEmpty({ message: 'A reason is required' })
  @MaxLength(500)
  reason: string;
}

/** The preview does not need a reason, so the user can see rule feedback while still typing. */
export class PreviewLeaveRequestDto {
  @IsInt()
  leaveTypeId: number;

  @Matches(DATE_RE, { message: 'startDate must be in YYYY-MM-DD format' })
  startDate: string;

  @Matches(DATE_RE, { message: 'endDate must be in YYYY-MM-DD format' })
  endDate: string;
}

export class DecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private service: LeaveRequestsService) {}

  @Post()
  @Roles('employee', 'manager')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveRequestDto) {
    return this.service.create(user, dto);
  }

  @Post('preview')
  @Roles('employee', 'manager')
  preview(@CurrentUser() user: AuthUser, @Body() dto: PreviewLeaveRequestDto) {
    return this.service.preview(user, dto);
  }

  @Get('mine')
  @Roles('employee', 'manager')
  mine(@CurrentUser() user: AuthUser) {
    return this.service.mine(user);
  }

  @Get('inbox')
  @Roles('manager', 'admin')
  inbox(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.service.inbox(user, status);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(user, id);
  }

  @Patch(':id/approve')
  @Roles('manager', 'admin')
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: DecisionDto) {
    return this.service.approve(user, id, dto.note);
  }

  @Patch(':id/reject')
  @Roles('manager', 'admin')
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: DecisionDto) {
    return this.service.reject(user, id, dto.note);
  }

  @Patch(':id/cancel')
  @Roles('employee', 'manager', 'admin')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.cancel(user, id);
  }
}
