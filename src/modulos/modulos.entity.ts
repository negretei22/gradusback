import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export interface PermisosModulo {
  [rol: string]: string[];
}

@Entity('modulos')
export class Modulo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column()
  ruta: string;

  @Column()
  icono: string;

  @Column('json', { nullable: true })
  permisos: PermisosModulo;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;
}