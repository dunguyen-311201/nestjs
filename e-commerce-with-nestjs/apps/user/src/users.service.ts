import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type { JwtPayload } from '@app/common';
import { UserRole } from '@app/shared';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

interface PostgresDriverError extends Error {
  code: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as PostgresDriverError).code === '23505'
  );
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    this.logger.log(`Creating user with email: ${createUserDto.email}`);
    const user = this.usersRepository.create(createUserDto);
    try {
      const saved = await this.usersRepository.save(user);
      this.logger.log(`User created with ID: ${saved.id}`);
      return saved;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Username or email already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    this.logger.debug('Fetching all users');
    return this.usersRepository.find();
  }

  async findOne(id: string): Promise<User> {
    this.logger.debug(`Finding user with ID: ${id}`);
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      this.logger.warn(`User not found: ${id}`);
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    requester: JwtPayload,
  ): Promise<User> {
    this.logger.log(`Updating user: ${id}`);
    const user = await this.findOne(id);
    this.assertSelfOrAdmin(id, requester, 'update');
    this.usersRepository.merge(user, updateUserDto);
    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Username or email already exists');
      }
      throw error;
    }
  }

  async remove(id: string, requester: JwtPayload): Promise<User> {
    this.logger.log(`Removing user: ${id}`);
    const user = await this.findOne(id);
    this.assertSelfOrAdmin(id, requester, 'delete');
    return this.usersRepository.remove(user);
  }

  private assertSelfOrAdmin(
    id: string,
    requester: JwtPayload,
    action: 'update' | 'delete',
  ): void {
    if (requester.role !== UserRole.ADMIN && requester.sub !== id) {
      throw new ForbiddenException(`You can only ${action} your own account`);
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ username });
  }
}
