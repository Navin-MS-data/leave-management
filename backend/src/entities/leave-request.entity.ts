import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RequestStatus } from '../common/types';
import { LeaveType } from './leave-type.entity';
import { User } from './user.entity';

@Entity('leave_requests')
@Index(['userId', 'status'])
export class LeaveRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'int' })
  leaveTypeId: number;

  @ManyToOne(() => LeaveType, { nullable: false })
  @JoinColumn({ name: 'leaveTypeId' })
  leaveType?: LeaveType;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  /** Working days only (weekends and public holidays excluded), computed when the request is made. */
  @Column({ type: 'int' })
  days: number;

  /** Calendar year of startDate. Balances are tracked per year. */
  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: RequestStatus;

  @Column({ type: 'int', nullable: true })
  decidedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'decidedById' })
  decidedBy?: User | null;

  @Column({ type: 'timestamp', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  decisionNote: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
