import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('municipios')
export class Municipios {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'int' })
  id_estado: number;
}
