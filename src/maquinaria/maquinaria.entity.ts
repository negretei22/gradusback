import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('maquinaria')
export class Maquinaria {

  @PrimaryGeneratedColumn({ name: 'id_maquinaria' })
  id_maquinaria: number;

  @Column({ type: 'int' })
  id_tipo_de_adquisicion: number;

  @Column({ type: 'int' })
  numero_activo: number;

  @Column({ type: 'varchar', length: 255 })
  numero_serie: string;

  @Column({ type: 'int' })
  id_marca: number;

  @Column({ type: 'int' })
  id_modelo: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'text' })
  descripcion: number;

  @Column({ type: 'int', nullable: true })
  id_documentos: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  valor_compra: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  importe_con_iva: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  importe_sin_iva: number;

  @Column({ type: 'date', nullable: true })
  fecha_de_adquisicion: Date;

  @Column({ type: 'int', nullable: true })
  plazo: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  pago_mensual: number;

  @Column({ type: 'int', nullable: true })
  id_arrendador: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  monto_renta_mensual: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
