import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('public_holidays')
export class PublicHoliday {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', unique: true })
  date: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;
}
