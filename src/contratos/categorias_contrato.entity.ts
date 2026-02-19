import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('categorias_contrato')
export class CategoriaContrato {
  @PrimaryGeneratedColumn({ name: 'id_categoria_contrato' })
  id_categoria_contrato: number;

  @Column({ name: 'nombre_categoria_contrato', type: 'varchar', length: 255, nullable: true })
  nombre_categoria_contrato: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ type: 'int', default: 1 })
  activo: number;
}
