import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

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
    const saved = await this.usersRepository.save(user);
    this.logger.log(`User created with ID: ${saved.id}`);
    return saved;
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

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log(`Updating user: ${id}`);
    const user = await this.findOne(id);
    this.usersRepository.merge(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<User> {
    this.logger.log(`Removing user: ${id}`);
    const user = await this.findOne(id);
    return this.usersRepository.remove(user);
  }
}
