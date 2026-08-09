import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Role } from '../roles/role.entity';

export enum UserRole {
  ADMIN = 'admin',
  GERENTE = 'gerente',
  CONTADOR = 'contador',
  USUARIO = 'usuario',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  nombre: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USUARIO,
  })
  role: UserRole;

  @ManyToOne(() => Role, (role) => role.users, { nullable: true, eager: true })
  @JoinColumn({ name: 'role_id' })
  roleEntity: Role;

  @CreateDateColumn()
  createdAt: Date;
}