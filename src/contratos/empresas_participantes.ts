import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('empresas_participantes')
export class EmpresasParticipantes {

  @PrimaryGeneratedColumn()
  id_empresa_participante: number;

  @Column('text')
  razon_social: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  campo1: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  campo2: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  campo3: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  campo4: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  campo5: string;
}
