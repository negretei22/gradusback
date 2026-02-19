import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('contratos')
export class Contrato {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  id_categoria: number;

  @Column({ unique: true, length: 100 })
  numero_contrato: string;

  @Column('text')
  descripcion: string;

  @Column('decimal', { precision: 10, scale: 2 })
  importe_contratado_sin_iva: number;

  @Column('decimal', { precision: 10, scale: 2 })
  importe_ejercido_sin_iva: number;
  
  @Column()
  id_contratante: number;

  @Column()
  id_empresa_principal: number;

  @Column()
  id_tipo_participacion: number;

  @Column({ length: 100 })
  id_empresas_participantes: string;

  @Column({ type: 'date', nullable: true })
  fecha_de_inicio: string;

  @Column({ type: 'date', nullable: true })
  fecha_de_terminacion: string;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  inserted_at: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updated_at: Date;
}
