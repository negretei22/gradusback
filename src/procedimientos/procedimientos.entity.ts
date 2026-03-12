import { Entity, Column, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('procedimientos')
export class Procedimiento {

    @PrimaryGeneratedColumn()
    id_procedimiento: number;

    @Column()
    id_tipo: number;

    @Column()
    numero_procedimiento: string;

    @Column({ type: 'text' })
    nombre_procedimiento: string;

    @Column({ type: 'text' })
    nombre_procedimiento_largo: string;

    @Column()
    siglas: string;

    @Column()
    estatus: string;

    @Column()
    estatus_alterno: string;

    @Column()
    tipo_procedimiento: string;

    @Column()
    cod_expediente: string;

    @Column({ type: 'text' })
    caracter: string;

    @Column({ type: 'datetime', nullable: true })
    fecha_aclaraciones: Date;

    @Column({ type: 'datetime', nullable: true })
    fecha_visita: Date;

    @Column({ type: 'datetime', nullable: true })
    fecha_fallo: Date;

    @Column({ type: 'datetime', nullable: true })
    fecha_apertura: Date;

    @Column()
    uuid_procedimiento: string;

    @Column()
    id_proceso: number;

    @Column({ type: 'datetime', nullable: true })
    fecha_limite: Date;

    @Column()
    entidad_federativa_contratacion: string;

    @Column({ type: 'text' })
    unidad_compradora: string;

    @Column()
    tipo_contratacion: string;

    @Column({ type: 'tinyint', default: 1 })
    activo: number;

}