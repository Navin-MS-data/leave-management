import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('leave_types')
export class LeaveType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 60, unique: true })
  name: string;

  /** Days per year. NULL means unlimited (for example unpaid leave). */
  @Column({ type: 'int', nullable: true })
  yearlyAllowance: number | null;

  @Column({ type: 'boolean', default: true })
  isPaid: boolean;
}
