import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('movimientos_financieros_pagos')
export class MovimientoFinancieroPago {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  movimiento_id: number;

  @Column({ type: 'int' })
  metodo_pago_id: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  importe: number;
}