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

  // Módulos a los que el rol tiene acceso (cualquier permiso)
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

  // Módulos que el rol puede ver Y que deben aparecer en el menú
  async findMenuByRole(role: string): Promise<Modulo[]> {
    const modulos = await this.modulosRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });

    return modulos.filter((m) => {
      const permisosRol = m.permisos?.[role];
      return (
        Array.isArray(permisosRol) &&
        permisosRol.includes('ver') &&
        permisosRol.includes('menu')
      );
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

  // ⚠️ TEMPORAL: ejecútalo una vez y bórralo.
  // Da 'menu' a todos los roles que ya tienen 'ver', para que el menú no se vacíe.
  async migrarMenu() {
    const modulos = await this.modulosRepository.find();
    for (const m of modulos) {
      const permisos = m.permisos || {};
      for (const rol of Object.keys(permisos)) {
        if (permisos[rol].includes('ver') && !permisos[rol].includes('menu')) {
          permisos[rol].push('menu');
        }
      }
      await this.modulosRepository.update(m.id, { permisos });
    }
    return { ok: true };
  }
}