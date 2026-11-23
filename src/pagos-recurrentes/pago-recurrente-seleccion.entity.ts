import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

// Selección guardada de las extras (movimientos del mes) de la Programación
// del Gasto (v13): un renglón por movimiento y mes. Si no existe renglón,
// la extra se considera incluida (default true); si existe, manda su valor.
// Así la selección sobrevive a F5 y queda guardada para siempre.
@Entity('pagos_recurrentes_seleccion')
@Unique(['anio', 'mes', 'movimiento_id'])
export class PagoRecurrenteSeleccion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'int' })
  mes: number;

  @Column({ type: 'int' })
  movimiento_id: number;

  @Column({ type: 'tinyint', default: 1 })
  incluido: number;
}
