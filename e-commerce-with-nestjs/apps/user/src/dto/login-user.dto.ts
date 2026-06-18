import { PickType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class LoginUserDto extends PickType(CreateUserDto, [
  'username',
] as const) {
  @IsString()
  @IsNotEmpty()
  password!: string;
}
