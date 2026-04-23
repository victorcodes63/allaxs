import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../domain/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 500, unique: true })
  tokenHash!: string;

  @Column({ type: 'timestamp with time zone' })
  expiresAt!: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  deviceId?: string;

  @Column({ type: 'boolean', default: false })
  isRevoked!: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  usedAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  revokedReason?: string;

  @Column({ type: 'uuid', nullable: true })
  replacedByToken?: string;
}
