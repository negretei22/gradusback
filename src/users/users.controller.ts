import { Controller, Get, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from './user.entity';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // 👇 QUITA ESTO DESPUÉS DE CREAR EL PRIMER ADMIN
  

  // ... tus demás métodos
}