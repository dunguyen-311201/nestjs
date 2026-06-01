import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly users: any[] = [];

  create(createUserDto: CreateUserDto) {
    const newUser = { ...createUserDto, id: Date.now() };
    this.users.push(newUser);
    return newUser;
  }

  findOne(id: number) {
    const user = this.users.find((user) => user.id === id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  findAll() {
    return this.users;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    const user = this.findOne(id);
    if (user) {
      Object.assign(user, updateUserDto);
      return user;
    }
    throw new NotFoundException('User not found');
  }

  remove(arg0: number) {
    const index = this.users.findIndex((user) => user.id === arg0);
    if (index !== -1) {
      const removedUser = this.users.splice(index, 1);
      return removedUser[0];
    }
    throw new NotFoundException('User not found');
  }
}
