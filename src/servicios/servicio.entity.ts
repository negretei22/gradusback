import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Maquinaria } from 'src/maquinaria/maquinaria.entity';

@Entity('servicio')
export class Servicio {
  @PrimaryGeneratedColumn()
  id_servicio: number;

  @Column({ length: 20, unique: true })
  codigo: string;

  @Column('date')
  fecha_servicio: string;

  @Column()
  id_activo: number;

  @ManyToOne(() => Maquinaria)
  @JoinColumn({ name: 'id_activo' })
  activo: Maquinaria;

  @Column('json', { nullable: true })
  fotos: { nombreOriginal: string; nombreArchivo: string }[];

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total: number;

  @Column('text', { nullable: true })
  comentarios: string;

  @CreateDateColumn({ name: 'fecha_insert' })
  fecha_insert: Date;

  @UpdateDateColumn({ name: 'fecha_update' })
  fecha_update: Date;
}