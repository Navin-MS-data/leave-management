import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Roles } from '../common/auth.decorators';
import { SettingsService } from './settings.service';

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  minNoticeDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxTeamOffPerDay?: number;
}

@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  /** Any signed-in user may read the settings (the request form shows the notice period). */
  @Get()
  get() {
    return this.settings.getAll();
  }

  @Put()
  @Roles('admin')
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
