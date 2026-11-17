import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Key/value store for admin-configurable values used by the business rules. */
@Entity('settings')
export class Setting {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  key: string;

  @Column({ type: 'varchar', length: 200 })
  value: string;
}
