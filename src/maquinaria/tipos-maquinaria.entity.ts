import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tipos_maquinaria')
export class TiposMaquinaria {

  @PrimaryGeneratedColumn({ name: 'id_tipo_maquinaria' })
  id_tipo_maquinaria: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;
}
