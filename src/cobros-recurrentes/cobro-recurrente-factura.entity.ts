import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// Facturas ligadas a un cobro recurrente (v4): un cobro puede tener varias
// facturas y su total es la suma de sus importe_sin_iva. Esta tabla es la
// fuente de verdad; cobros_recurrentes.movimiento_id solo guarda el primer
// id por compatibilidad.
@Entity('cobros_recurrentes_facturas')
export class CobroRecurrenteFactura {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  cobro_recurrente_id: number;

  @Column({ type: 'int' })
  movimiento_id: number;
}
