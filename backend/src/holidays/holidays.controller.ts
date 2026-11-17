import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";
import { Between, Repository } from "typeorm";
import { Roles } from "../common/auth.decorators";
import { isValidISODate } from "../common/dates";
import { PublicHoliday } from "../entities";

export class CreateHolidayDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be in YYYY-MM-DD format" })
  date: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}

@Controller("holidays")
export class HolidaysController {
  constructor(@InjectRepository(PublicHoliday) private repo: Repository<PublicHoliday>) {}

  @Get()
  list(@Query("year") year?: string) {
    const y = year ? Number(year) : undefined;
    if (y && Number.isInteger(y)) {
      return this.repo.find({
        where: { date: Between(`${y}-01-01`, `${y}-12-31`) },
        order: { date: "ASC" },
      });
    }
    return this.repo.find({ order: { date: "ASC" } });
  }

  @Post()
  @Roles("admin")
  async create(@Body() dto: CreateHolidayDto) {
    if (!isValidISODate(dto.date))
      throw new BadRequestException("date is not a valid calendar date");
    if (await this.repo.findOneBy({ date: dto.date })) {
      throw new ConflictException("A holiday already exists on that date");
    }
    return this.repo.save(this.repo.create(dto));
  }

  @Delete(":id")
  @Roles("admin")
  async remove(@Param("id", ParseIntPipe) id: number) {
    const holiday = await this.repo.findOneBy({ id });
    if (!holiday) throw new NotFoundException("Holiday not found");
    await this.repo.remove(holiday);
    return { deleted: true };
  }
}
