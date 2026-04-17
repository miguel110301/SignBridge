import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Mission } from './mission.entity';

@Entity({ name: 'user_missions' })
@Unique(['userId', 'missionId'])
export class UserMission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'mission_id', type: 'uuid' })
  missionId!: string;

  @ManyToOne(() => Mission, (mission) => mission.userMissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mission_id' })
  mission!: Mission;

  @Column({ name: 'xp_granted', type: 'int' })
  xpGranted!: number;

  @Column({ name: 'completed_at', type: 'timestamptz' })
  completedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
