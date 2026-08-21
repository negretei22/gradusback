import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tipo_servicio')
export class TipoServicio {
  @PrimaryGeneratedColumn()
  id_tipo_servicio: number;

  @Column({ length: 50 })
  tipo_servicio: string;
}