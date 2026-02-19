import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('estados') // cambia el nombre si tu tabla es otra
export class Estados{

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  nombre: string;

  @Column({ type: 'int', width: 3 })
  pais: number;
}
