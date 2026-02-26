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
  
  @Column({ type: 'int', nullable: true })
  categoria_id: number;

  @Column({ type: 'date', nullable: true  })
  fecha_pago: Date;

  @Column({ type: 'date', nullable: true  })
  fecha_factura: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  folio_fiscal: string;

  @Column({ type: 'text', nullable: true })
  rfc: string;

  @Column({ type: 'text', nullable: true })
  razon_social: string;

  @Column({ type: 'varchar', length: 255 })
  concepto: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  importe_sin_iva: number;

  @Column({ type: 'tinyint', default: 0 })
  iva: number; // 0,8,16

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  iva_acreditable: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  iva_traslado: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  isr_retenido: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  iva_retenido: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  gran_total: number;

  @Column({ type: 'int', nullable: true })
  metodo_pago_id: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}
