import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('movimientos_financieros')
export class MovimientoFinanciero {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  tipo_movimiento_id: string;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'int', nullable: true })
  categoria_id: number;

  @Column({ type: 'text', nullable: true })
  razon_social: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  folio: string;

  @Column({ type: 'varchar', length: 255 })
  concepto: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  monto: number;

  @Column({ type: 'tinyint', default: 0 })
  iva: number; // 0,8,16

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  monto_mas_iva: number;

  @Column({ type: 'int', nullable: true })
  cuenta_id: number;

  @Column({ type: 'int', nullable: true })
  metodo_pago_id: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  monto2: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  monto3: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  monto4: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  gran_total: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}
