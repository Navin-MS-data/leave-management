import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequest, LeaveType } from '../entities';
import { LeaveTypesController } from './leave-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveType, LeaveRequest])],
  controllers: [LeaveTypesController],
})
export class LeaveTypesModule {}
