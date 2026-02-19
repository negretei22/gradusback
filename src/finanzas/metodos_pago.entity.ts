import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from 'typeorm';

@Entity('metodos_pago')
export class MetodoPago {

  @PrimaryGeneratedColumn()
  id: number;

  // Nombre del método (EFECTIVO, TRANSFERENCIA, TARJETA, CHEQUE)
  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @CreateDateColumn()
  created_at: Date;
}
