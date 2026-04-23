import { BaseEntity } from 'src/domain/base.entity';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from 'src/users/entities/user.entity';

@Entity('admin_audit_logs')
export class AdminAuditLog extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'admin_user_id', nullable: true })
  adminUserId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'admin_user_id' })
  adminUser?: User | null;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  action!: string; // e.g., APPROVE_EVENT, REFUND_ORDER, UPDATE_USER_ROLES

  @Index()
  @Column({ type: 'varchar', length: 64, name: 'resource_type' })
  resourceType!: string; // e.g., event, order, user

  @Index()
  @Column({ type: 'varchar', length: 255, name: 'resource_id', nullable: true })
  resourceId?: string | null; // UUID or string id of the resource

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>; // Optional extra context

  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'SUCCESS' })
  status!: string; // SUCCESS or FAILURE
}
