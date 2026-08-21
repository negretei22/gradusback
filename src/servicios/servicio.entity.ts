import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { TipoServicio } from './tipo-servicio.entity';
import { ServicioDetalle } from './servicio-detalle.entity';
import { Maquinaria } from 'src/maquinaria/maquinaria.entity';

@Entity('servicio')
export class Servicio {
  @PrimaryGeneratedColumn()
  id_servicio: number;

  @Column({ length: 20, unique: true })
  codigo: string;

  @Column()
  id_tipo_servicio: number;

  @ManyToOne(() => TipoServicio)
  @JoinColumn({ name: 'id_tipo_servicio' })
  tipoServicio: TipoServicio;

  @Column('date')
  fecha_servicio: string;

  @Column()
  id_activo: number;

  @ManyToOne(() => Maquinaria)
  @JoinColumn({ name: 'id_activo' })
  activo: Maquinaria;

  @Column('text', { nullable: true })
  fotos: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  iva: number;

  @OneToMany(() => ServicioDetalle, d => d.servicio, { cascade: true, eager: true })
  detalles: ServicioDetalle[];
}