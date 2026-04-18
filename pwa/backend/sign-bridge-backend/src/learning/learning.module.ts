import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Mission } from './entities/mission.entity';
import { LearningModuleEntity } from './entities/module.entity';
import { UserMission } from './entities/user-mission.entity';
import { LearningService } from './learning.service';
import { MissionsController } from './missions.controller';
import { ModulesController } from './modules.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LearningModuleEntity,
      Mission,
      UserMission,
      User,
    ]),
  ],
  providers: [LearningService],
  controllers: [ModulesController, MissionsController],
  exports: [LearningService],
})
export class LearningModule {}
