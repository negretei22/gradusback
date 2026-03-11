import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('procedimientos')
export class Procedimiento {

@PrimaryGeneratedColumn()
id: number;

@Column()
numero_procedimiento: string;

@Column('text')
descripcion: string;

@Column()
estado: string;

@Column({ type:'datetime', nullable:true })
fecha_visita: Date;

@Column({ type:'datetime', nullable:true })
fecha_aclaraciones: Date;

@Column({ type:'datetime', nullable:true })
fecha_apertura: Date;

@Column({ type:'datetime', nullable:true })
fecha_fallo: Date;

}