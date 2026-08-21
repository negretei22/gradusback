import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Servicio } from './servicio.entity';

@Entity('servicio_detalle')
export class ServicioDetalle {
  @PrimaryGeneratedColumn()
  id_detalle: number;

  @Column()
  id_servicio: number;

  @ManyToOne(() => Servicio, s => s.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_servicio' })
  servicio: Servicio;

  @Column({ type: 'text' })
  descripcion: string;
}