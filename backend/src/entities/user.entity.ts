import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../common/types';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  email: string;

  /** Excluded from normal selects; loaded explicitly by the login flow. */
  @Column({ type: 'varchar', select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20 })
  role: Role;

  /**
   * The manager this user reports to. A "team" is a manager plus their direct reports.
   * Managers and admins have no manager (a manager's leave is decided by an admin).
   */
  @Column({ type: 'int', nullable: true })
  managerId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'managerId' })
  manager?: User | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

/** Id of the user whose team this user belongs to (a manager is their own team's key). */
export function teamKeyOf(user: Pick<User, 'id' | 'role' | 'managerId'>): number | null {
  if (user.role === 'manager') return user.id;
  if (user.role === 'employee') return user.managerId;
  return null;
}
