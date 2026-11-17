import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser, Roles } from '../common/auth.decorators';
import { AuthUser, ROLES, Role } from '../common/types';
import { User } from '../entities';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsIn(ROLES as unknown as string[])
  role: Role;

  @IsOptional()
  @IsInt()
  managerId?: number | null;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsIn(ROLES as unknown as string[])
  role?: Role;

  @IsOptional()
  @IsInt()
  managerId?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@Controller('users')
export class UsersController {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  @Get()
  @Roles('admin')
  list() {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  /** A manager's direct reports. */
  @Get('reports')
  @Roles('manager')
  reports(@CurrentUser() actor: AuthUser) {
    return this.repo.find({ where: { managerId: actor.id, active: true }, order: { name: 'ASC' } });
  }

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    if (await this.repo.findOneBy({ email })) throw new ConflictException('Email is already in use');
    const managerId = await this.resolveManagerId(dto.role, dto.managerId ?? null);
    const user = this.repo.create({
      name: dto.name,
      email,
      role: dto.role,
      managerId,
      active: true,
      passwordHash: await bcrypt.hash(dto.password, 10),
    });
    const saved = await this.repo.save(user);
    return this.repo.findOneByOrFail({ id: saved.id });
  }

  @Patch(':id')
  @Roles('admin')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    if (id === actor.id && (dto.active === false || (dto.role && dto.role !== 'admin'))) {
      throw new BadRequestException('You cannot deactivate or demote your own account');
    }
    const role = dto.role ?? user.role;
    if (dto.role !== undefined || dto.managerId !== undefined) {
      user.managerId = await this.resolveManagerId(role, dto.managerId !== undefined ? dto.managerId : user.managerId);
      user.role = role;
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.active !== undefined) user.active = dto.active;
    if (dto.password) user.passwordHash = await bcrypt.hash(dto.password, 10);
    await this.repo.save(user);
    return this.repo.findOneByOrFail({ id });
  }

  /** Employees must report to a manager; managers and admins have no manager. */
  private async resolveManagerId(role: Role, managerId: number | null): Promise<number | null> {
    if (role !== 'employee') return null;
    if (managerId === null) throw new BadRequestException('An employee must have a manager');
    const manager = await this.repo.findOneBy({ id: managerId });
    if (!manager || manager.role !== 'manager') {
      throw new BadRequestException('managerId must refer to a user with the manager role');
    }
    return managerId;
  }
}
