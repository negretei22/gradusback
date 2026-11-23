import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('pagos_recurrentes')
export class PagoRecurrente {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  concepto: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  beneficiario: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  fiscal: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  no_fiscal: number;

  // Día del mes en que se paga (1-31). null = "Por definir".
  @Column({ type: 'int', nullable: true })
  dia_pago: number | null;

  @Column({ type: 'tinyint', default: 1 })
  activo: number;

  // 0 = monto fijo guardado, 1 = monto de la factura del mes.
  @Column({ type: 'tinyint', default: 0 })
  monto_factura: number;

  // Movimiento financiero de origen (cuando se dio de alta buscando una factura).
  @Column({ type: 'int', nullable: true })
  movimiento_id: number | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}
