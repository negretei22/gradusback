import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    const users = await this.usersRepository.find();
    // 👇 Quitamos la contraseña de la respuesta por seguridad
    return users.map(user => {
      const { password, ...result } = user as any;
      return result;
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    
    const { password, ...result } = user as any;
    return result;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    // Verificar que no exista el email
    const existe = await this.findByEmail(dto.email);
    if (existe) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    
    const user = this.usersRepository.create({
      ...dto,
      password: hashedPassword,
      isActive: dto.isActive ?? true,
    });

    const saved = await this.usersRepository.save(user);
    
    // No devolver la contraseña
    const { password, ...result } = saved as any;
    return result;
  }

  async update(id: string, dto: Partial<CreateUserDto>): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Si cambia el email, verificar que no exista
    if (dto.email && dto.email !== user.email) {
      const existe = await this.findByEmail(dto.email);
      if (existe) throw new ConflictException('Ya existe un usuario con ese email');
    }

    // Si viene nueva contraseña, hashearla
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    await this.usersRepository.update(id, dto);
    
    const updated = await this.findById(id);
    return updated;
  }

  async remove(id: string): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    
    await this.usersRepository.delete(id);
    return { message: 'Usuario eliminado correctamente' };
  }
}