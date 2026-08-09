import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ relations: ['roleEntity'] });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['roleEntity'],
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roleEntity'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(data: Partial<User>): Promise<User> {
    if (!data.password) {
      throw new Error('La contraseña es requerida');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = this.usersRepository.create({
      ...data,
      password: hashedPassword,
    });
    return this.usersRepository.save(user);
  }
  
  async update(id: string, data: Partial<User>): Promise<User> {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    await this.usersRepository.update(id, data);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }
}