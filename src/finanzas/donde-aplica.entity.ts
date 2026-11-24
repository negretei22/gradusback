import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('donde_aplica')
export class DondeAplica {

  @PrimaryGeneratedColumn({ name: 'id_donde_aplica' })
  id_donde_aplica: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;
}
