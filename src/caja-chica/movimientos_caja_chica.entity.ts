import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('movimientos_caja_chica')
export class MovimientoCajaChica {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'varchar', length: 255 })
  concepto: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  gasto: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  ingreso: number;

  @Column({ type: 'varchar', length: 100 })
  capturo: string;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}