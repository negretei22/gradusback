import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Modulo } from './modulos.entity';

@Injectable()
export class ModulosService {
  constructor(
    @InjectRepository(Modulo)
    private modulosRepository: Repository<Modulo>,
  ) {}

  async findByRole(role: string): Promise<Modulo[]> {
    const modulos = await this.modulosRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });

    return modulos.filter((m) => {
      const permisosRol = m.permisos?.[role];
      return Array.isArray(permisosRol) && permisosRol.length > 0;
    });
  }

  async findAll(): Promise<Modulo[]> {
    return this.modulosRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async findByRuta(ruta: string): Promise<Modulo | null> {
    return this.modulosRepository.findOne({
      where: { ruta, activo: true },
    });
  }

  async create(data: Partial<Modulo>): Promise<Modulo> {
    const modulo = this.modulosRepository.create({
      ...data,
      permisos: data.permisos || {},
      activo: true,
    });
    return this.modulosRepository.save(modulo);
  }

  async update(id: string, data: Partial<Modulo>): Promise<any> {
    return this.modulosRepository.update(id, data);
  }

  async updatePermisos(
    id: string,
    permisos: Record<string, string[]>,
  ): Promise<any> {
    return this.modulosRepository.update(id, { permisos });
  }

  async remove(id: string): Promise<any> {
    return this.modulosRepository.update(id, { activo: false });
  }
}