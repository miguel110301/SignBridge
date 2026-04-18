import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LearningModuleEntity } from './module.entity';
import { UserMission } from './user-mission.entity';

@Entity({ name: 'missions' })
export class Mission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'module_id', type: 'uuid' })
  moduleId!: string;

  @ManyToOne(() => LearningModuleEntity, (learningModule) => learningModule.missions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'module_id' })
  module!: LearningModuleEntity;

  @Column({ length: 120 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'xp_reward', type: 'int', default: 10 })
  xpReward!: number;

  @Column({ name: 'display_order', type: 'int', default: 1 })
  displayOrder!: number;

  @OneToMany(() => UserMission, (userMission) => userMission.mission)
  userMissions!: UserMission[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
