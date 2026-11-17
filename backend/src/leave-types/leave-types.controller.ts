import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { Roles } from '../common/auth.decorators';
import { LeaveRequest, LeaveType } from '../entities';

export class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  /** Days per year. Omit or send null for unlimited. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(366)
  yearlyAllowance?: number | null;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(366)
  yearlyAllowance?: number | null;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}

@Controller('leave-types')
export class LeaveTypesController {
  constructor(
    @InjectRepository(LeaveType) private repo: Repository<LeaveType>,
    @InjectRepository(LeaveRequest) private requests: Repository<LeaveRequest>,
  ) {}

  @Get()
  list() {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateLeaveTypeDto) {
    if (await this.repo.findOneBy({ name: dto.name })) {
      throw new ConflictException('A leave type with that name already exists');
    }
    return this.repo.save(
      this.repo.create({
        name: dto.name,
        yearlyAllowance: dto.yearlyAllowance ?? null,
        isPaid: dto.isPaid ?? true,
      }),
    );
  }

  /** Changing the allowance takes effect immediately, because balances are computed on read. */
  @Patch(':id')
  @Roles('admin')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeaveTypeDto) {
    const type = await this.repo.findOneBy({ id });
    if (!type) throw new NotFoundException('Leave type not found');
    if (dto.name && dto.name !== type.name && (await this.repo.findOneBy({ name: dto.name }))) {
      throw new ConflictException('A leave type with that name already exists');
    }
    if (dto.name !== undefined) type.name = dto.name;
    if (dto.yearlyAllowance !== undefined) type.yearlyAllowance = dto.yearlyAllowance;
    if (dto.isPaid !== undefined) type.isPaid = dto.isPaid;
    return this.repo.save(type);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const type = await this.repo.findOneBy({ id });
    if (!type) throw new NotFoundException('Leave type not found');
    if ((await this.requests.countBy({ leaveTypeId: id })) > 0) {
      throw new ConflictException('This leave type is used by existing requests and cannot be deleted');
    }
    await this.repo.remove(type);
    return { deleted: true };
  }
}
