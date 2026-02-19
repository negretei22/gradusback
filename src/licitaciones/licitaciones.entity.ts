import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('licitaciones')
export class Licitacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  numero: string;

  @Column()
  dependencia: string;

  @Column('text')
  descripcion: string;
}

