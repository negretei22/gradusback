import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Modulo } from './modulos.entity';
import { UserRole } from 'src/shared/enums/user-role.enum';

@Injectable()
export class ModulosService {
    constructor(
        @InjectRepository(Modulo)
        private modulosRepository: Repository<Modulo>,
    ) { }

    // 👇 Busca módulos donde el rol del usuario tenga al menos un permiso
    async findByRole(role: UserRole): Promise<Modulo[]> {
        const modulos = await this.modulosRepository.find({
            where: { activo: true },
            order: { nombre: 'ASC' }
        });

        console.log('🔍 Buscando módulos para rol:', role);
        console.log('📦 Total módulos en BD:', modulos.length);

        const filtrados = modulos.filter(m => {
            const permisosRol = m.permisos?.[role];
            console.log(`  → ${m.nombre}: permisos[${role}] =`, permisosRol);
            return Array.isArray(permisosRol) && permisosRol.length > 0;
        });

        console.log('✅ Módulos permitidos:', filtrados.map(m => m.nombre));
        return filtrados;
    }


    async findAll(): Promise<Modulo[]> {
        return this.modulosRepository.find({
            where: { activo: true },
            order: { nombre: 'ASC' }
        });
    }

    async findByRuta(ruta: string): Promise<Modulo | null> {
        return this.modulosRepository.findOne({
            where: { ruta, activo: true }
        });
    }

    async create(data: Partial<Modulo>): Promise<Modulo> {
        const modulo = this.modulosRepository.create(data);
        return this.modulosRepository.save(modulo);
    }

    async seedModulos(): Promise<void> {
        const count = await this.modulosRepository.count();
        if (count > 0) return;

        const modulos = [
            {
                nombre: 'Activos',
                ruta: '/maquinaria',
                icono: '🚜',
                permisos: {
                    admin: ['ver', 'editar', 'eliminar'],

                }
            },
            {
                nombre: 'Caja Chica',
                ruta: '/caja-chica',
                icono: '💵',
                permisos: {
                    admin: ['ver', 'editar', 'eliminar'],

                }
            },
            {
                nombre: 'Contratos',
                ruta: '/contratos',
                icono: '📑',
                permisos: {
                    admin: ['ver', 'editar', 'eliminar'],

                }
            },
            {
                nombre: 'Finanzas',
                ruta: '/finanzas',
                icono: '💰',
                permisos: {
                    admin: ['ver', 'editar', 'eliminar'],
                    contador: ['ver'],
                }
            },
            {
                nombre: 'Puerto Peñasco',
                ruta: '/obra-puerto-penasco',
                icono: '🏗️',
                permisos: {
                    admin: ['ver', 'editar', 'eliminar'],

                }
            },
            {
                nombre: 'Usuarios',
                ruta: '/users',
                icono: '👤',
                permisos: {
                    admin: ['ver', 'editar', 'eliminar'],
                }
            },
        ];

        for (const m of modulos) {
            await this.modulosRepository.save(m);
        }
    }
}