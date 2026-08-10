import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';

@Controller('roles')
export class RolesController {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) {}

  @Get()
  async findAll() {
    return this.rolesRepository.find({ order: { nombre: 'ASC' } });
  }
}