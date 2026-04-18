import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Mission } from './entities/mission.entity';
import { LearningModuleEntity } from './entities/module.entity';
import { UserMission } from './entities/user-mission.entity';

type ModuleMissionView = {
  id: string;
  title: string;
  description: string | null;
  xpReward: number;
  displayOrder: number;
  completed: boolean;
};

type ModuleView = {
  id: string;
  title: string;
  description: string | null;
  displayOrder: number;
  totalMissions: number;
  completedMissions: number;
  completionRate: number;
  missions: ModuleMissionView[];
};

@Injectable()
export class LearningService {
  private static readonly XP_PER_LEVEL = 100;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(LearningModuleEntity)
    private readonly modulesRepository: Repository<LearningModuleEntity>,
    @InjectRepository(UserMission)
    private readonly userMissionsRepository: Repository<UserMission>,
  ) {}

  async getModules(userId: string): Promise<ModuleView[]> {
    const [modules, completedMissions] = await Promise.all([
      this.modulesRepository.find({
        relations: {
          missions: true,
        },
        order: {
          displayOrder: 'ASC',
          missions: {
            displayOrder: 'ASC',
          },
        },
      }),
      this.userMissionsRepository.find({
        where: { userId },
      }),
    ]);

    const completedMissionIds = new Set(
      completedMissions.map((entry) => entry.missionId),
    );

    return modules.map((learningModule) => {
      const missions: ModuleMissionView[] = learningModule.missions.map(
        (mission) => ({
          id: mission.id,
          title: mission.title,
          description: mission.description,
          xpReward: mission.xpReward,
          displayOrder: mission.displayOrder,
          completed: completedMissionIds.has(mission.id),
        }),
      );

      const totalMissions = missions.length;
      const completedCount = missions.filter(
        (mission) => mission.completed,
      ).length;

      return {
        id: learningModule.id,
        title: learningModule.title,
        description: learningModule.description,
        displayOrder: learningModule.displayOrder,
        totalMissions,
        completedMissions: completedCount,
        completionRate:
          totalMissions > 0
            ? Math.round((completedCount / totalMissions) * 100)
            : 0,
        missions,
      };
    });
  }

  async completeMission(userId: string, missionId: string) {
    return this.dataSource.transaction(async (manager) => {
      const usersRepository = manager.getRepository(User);
      const missionsRepository = manager.getRepository(Mission);
      const userMissionsRepository = manager.getRepository(UserMission);

      const [user, mission] = await Promise.all([
        usersRepository.findOne({ where: { id: userId } }),
        missionsRepository.findOne({ where: { id: missionId } }),
      ]);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!mission) {
        throw new NotFoundException('Mission not found');
      }

      const existingCompletion = await userMissionsRepository.findOne({
        where: {
          userId,
          missionId,
        },
      });

      if (existingCompletion) {
        const moduleTotals = await this.getModuleProgressStats(
          manager,
          userId,
          mission.moduleId,
        );

        return {
          missionId,
          moduleId: mission.moduleId,
          alreadyCompleted: true,
          gainedXp: 0,
          totalXp: user.xp,
          level: user.level,
          xpForNextLevel: this.getXpForNextLevel(user.xp),
          moduleProgress: moduleTotals,
        };
      }

      const gainedXp = mission.xpReward;

      const completion = userMissionsRepository.create({
        userId,
        missionId,
        xpGranted: gainedXp,
        completedAt: new Date(),
      });

      await userMissionsRepository.save(completion);

      user.xp += gainedXp;
      user.level = this.calculateLevel(user.xp);
      await usersRepository.save(user);

      const moduleTotals = await this.getModuleProgressStats(
        manager,
        userId,
        mission.moduleId,
      );

      return {
        missionId,
        moduleId: mission.moduleId,
        alreadyCompleted: false,
        gainedXp,
        totalXp: user.xp,
        level: user.level,
        xpForNextLevel: this.getXpForNextLevel(user.xp),
        moduleProgress: moduleTotals,
      };
    });
  }

  private calculateLevel(totalXp: number): number {
    return Math.floor(totalXp / LearningService.XP_PER_LEVEL) + 1;
  }

  private getXpForNextLevel(totalXp: number): number {
    const progressInCurrentLevel = totalXp % LearningService.XP_PER_LEVEL;

    return progressInCurrentLevel === 0
      ? LearningService.XP_PER_LEVEL
      : LearningService.XP_PER_LEVEL - progressInCurrentLevel;
  }

  private async getModuleProgressStats(
    manager: EntityManager,
    userId: string,
    moduleId: string,
  ): Promise<{
    completedMissions: number;
    totalMissions: number;
    completionRate: number;
  }> {
    const missionsRepository = manager.getRepository(Mission);
    const userMissionsRepository = manager.getRepository(UserMission);

    const totalMissions = await missionsRepository.count({
      where: { moduleId },
    });

    const completedMissions = await userMissionsRepository
      .createQueryBuilder('userMission')
      .innerJoin(Mission, 'mission', 'mission.id = userMission.mission_id')
      .where('userMission.user_id = :userId', { userId })
      .andWhere('mission.module_id = :moduleId', { moduleId })
      .getCount();

    return {
      completedMissions,
      totalMissions,
      completionRate:
        totalMissions > 0
          ? Math.round((completedMissions / totalMissions) * 100)
          : 0,
    };
  }
}
