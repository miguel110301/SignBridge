import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type PublicUser = {
  id: string;
  name: string;
  email: string;
  xp: number;
  level: number;
  createdAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{
    accessToken: string;
    user: PublicUser;
  }> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = await this.usersService.createUser({
      name: registerDto.name,
      email: registerDto.email,
      passwordHash,
    });

    return {
      accessToken: this.signToken(user),
      user: this.toPublicUser(user),
    };
  }

  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    user: PublicUser;
  }> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordIsValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      accessToken: this.signToken(user),
      user: this.toPublicUser(user),
    };
  }

  async profile(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toPublicUser(user);
  }

  private signToken(user: User): string {
    const secret = this.configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new InternalServerErrorException('JWT_SECRET is not configured');
    }

    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
      },
      secret,
      {
        expiresIn: '7d',
      },
    );
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      xp: user.xp,
      level: user.level,
      createdAt: user.createdAt,
    };
  }
}