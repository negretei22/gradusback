import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('arrendadores_maquinaria')
export class ArrendadoresMaquinaria {

  @PrimaryGeneratedColumn()
  id_arrendador: number;

  @Column({ type: 'varchar', length: 150 })
  razon_social: string;

  @Column({ type: 'int' })
  id_estado: number;

  @Column({ type: 'int' })
  id_municipio: number;

  @Column({ type: 'int' })
  codigo_postal: number;

  @Column({ type: 'int' })
  id_colonia: number;

  @Column({ type: 'varchar', length: 150 })
  calle: string;

  @Column({ type: 'varchar', length: 12 })
  numero_exterior: string;

  @Column({ type: 'varchar', length: 12, nullable: true })
  numero_interior: string;

  @Column({ type: 'int', default: 1 })
  activo: number;
  
}
