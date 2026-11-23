import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

// Override manual del checkbox Pagado del reporte (v5): un renglón por
// pago recurrente y mes. Si existe, este valor MANDA sobre el pagado
// derivado de las facturas; si no existe, se usa el derivado. El override
// siempre se guarda (true -> 1, false -> 0), nunca se borra.
@Entity('pagos_recurrentes_pagos')
@Unique(['pago_recurrente_id', 'anio', 'mes'])
export class PagoRecurrentePago {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  pago_recurrente_id: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'int' })
  mes: number;

  @Column({ type: 'tinyint', default: 0 })
  pagado: number;
}
