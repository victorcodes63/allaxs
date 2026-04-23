import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { NotifyChannel, NotifyStatus } from './enums';

@Entity('notifications')
export class Notification extends BaseEntity {
  @Index()
  @Column({ type: 'enum', enum: NotifyChannel })
  channel!: NotifyChannel;

  @Column({ type: 'varchar', length: 120, nullable: true })
  template?: string;

  @Column({ type: 'varchar', length: 255 })
  to!: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, any>;

  @Index()
  @Column({ type: 'enum', enum: NotifyStatus, default: NotifyStatus.PENDING })
  status!: NotifyStatus;

  @Column({ type: 'text', nullable: true })
  error?: string;
}
