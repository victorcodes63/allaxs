import { BaseEntity } from 'src/domain/base.entity';
import { Role, UserStatus } from 'src/domain/enums';
import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { Order } from 'src/domain/order.entity';
import { Ticket } from 'src/domain/ticket.entity';
import { OrganizerProfile } from './organizer-profile.entity';
import { CheckIn } from 'src/domain/checkin.entity';

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'citext', unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  passwordHash?: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  name?: string;

  @Column({ type: 'enum', enum: Role, array: true, default: [Role.ATTENDEE] })
  roles!: Role[];

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @OneToOne(() => OrganizerProfile, (o) => o.user)
  organizer?: OrganizerProfile;

  @OneToMany(() => Order, (o) => o.user)
  orders!: Order[];

  @OneToMany(() => Ticket, (t) => t.ownerUser)
  tickets!: Ticket[];

  @OneToMany(() => CheckIn, (c) => c.operator)
  checkIns!: CheckIn[];
}
