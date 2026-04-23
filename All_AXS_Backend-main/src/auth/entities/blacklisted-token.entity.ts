import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../domain/base.entity';

@Entity('blacklisted_tokens')
export class BlacklistedToken extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 500, unique: true })
  token!: string;

  @Column({ type: 'timestamp with time zone' })
  expiresAt!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason?: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId?: string;
}
