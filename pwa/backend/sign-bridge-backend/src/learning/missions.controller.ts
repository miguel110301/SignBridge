import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle, minutes } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LearningService } from './learning.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub: string;
    email: string;
  };
};

@Controller('missions')
@UseGuards(JwtAuthGuard)
export class MissionsController {
  constructor(private readonly learningService: LearningService) {}

  @Throttle({ default: { limit: 30, ttl: minutes(1) } })
  @Post(':missionId/complete')
  async completeMission(
    @Param('missionId', new ParseUUIDPipe()) missionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return this.learningService.completeMission(req.user.sub, missionId);
  }
}
