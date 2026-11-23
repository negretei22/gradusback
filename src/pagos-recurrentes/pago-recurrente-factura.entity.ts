import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// Facturas ligadas a un pago recurrente (v4): un pago puede tener varias
// facturas y su total es la suma de sus importe_sin_iva. Esta tabla es la
// fuente de verdad; pagos_recurrentes.movimiento_id solo guarda el primer
// id por compatibilidad.
@Entity('pagos_recurrentes_facturas')
export class PagoRecurrenteFactura {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  pago_recurrente_id: number;

  @Column({ type: 'int' })
  movimiento_id: number;
}
