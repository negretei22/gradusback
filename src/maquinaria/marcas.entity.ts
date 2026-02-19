import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('marcas')
export class Marcas {
  @PrimaryGeneratedColumn({ name: 'id_marca' })
  id_marca: number;

  @Column({ type: 'varchar', length: 255 })
  marca: string;
}