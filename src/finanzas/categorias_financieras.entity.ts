import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from 'typeorm';

@Entity('categorias_financieras')
export class CategoriaFinanciera {

  @PrimaryGeneratedColumn()
  id: number;

  // Nombre de la categoría (Nómina, Gasolina, Venta, etc)
  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  // Tipo movimiento: 1 ingreso, 2 egreso
  @Column()
  tipo_movimiento_id: number;

  @CreateDateColumn()
  created_at: Date;
}
