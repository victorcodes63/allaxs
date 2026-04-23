import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../domain/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('password_resets')
export class PasswordReset extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  token!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'timestamp with time zone' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  isUsed!: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  usedAt?: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;
}
