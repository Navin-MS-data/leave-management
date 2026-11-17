import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicHoliday } from '../entities';
import { HolidaysController } from './holidays.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PublicHoliday])],
  controllers: [HolidaysController],
})
export class HolidaysModule {}
