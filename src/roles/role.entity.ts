import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  nombre: string; // admin, gerente, contador, usuario

  @Column({ nullable: true })
  descripcion: string;

  @OneToMany(() => User, (user) => user.roleEntity)
  users: User[];
}