import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';


@Entity('modelos')
export class Modelos {

  @PrimaryGeneratedColumn({ name: 'id_modelo' })
  id_modelo: number;

  @Column({ name: 'modelo', type: 'varchar', length: 255 })
  modelo: string;

  @Column({ name: 'id_marca' })
  id_marca: number;

}