import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

// Override manual del checkbox Pagado del reporte (v5): un renglón por
// cobro recurrente y mes. Si existe, este valor MANDA sobre el pagado
// derivado de las facturas; si no existe, se usa el derivado. El override
// siempre se guarda (true -> 1, false -> 0), nunca se borra.
@Entity('cobros_recurrentes_pagos')
@Unique(['cobro_recurrente_id', 'anio', 'mes'])
export class CobroRecurrentePago {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  cobro_recurrente_id: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'int' })
  mes: number;

  @Column({ type: 'tinyint', default: 0 })
  pagado: number;
}
