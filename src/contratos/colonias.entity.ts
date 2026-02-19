import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('colonias')
export class Colonias {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'varchar', length: 255 })
  ciudad: string;

  @Column({ type: 'int' })
  municipio: number;

  @Column({ type: 'varchar', length: 255 })
  asentamiento: string;

  @Column({ type: 'int' })
  codigo_postal: number;
}
