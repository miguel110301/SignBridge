import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LearningService } from './learning.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub: string;
    email: string;
  };
};

@Controller('modules')
@UseGuards(JwtAuthGuard)
export class ModulesController {
  constructor(private readonly learningService: LearningService) {}

  @Get()
  async getModules(@Req() req: AuthenticatedRequest) {
    if (!req.user?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return this.learningService.getModules(req.user.sub);
  }
}
