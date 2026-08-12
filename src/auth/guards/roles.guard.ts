import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../shared/enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();

    // ========== DEBUG ==========
    console.log('🛡️ ROLES GUARD DEBUG');
    console.log('req.user completo:', user);
    console.log('Rol del usuario (user.role):', user?.role);
    console.log('Roles requeridos:', requiredRoles);
    console.log('Enum ADMIN:', UserRole.ADMIN);
    console.log('Enum SUPERADMIN:', UserRole.SUPERADMIN);
    // ===========================

    if (!user || !user.role) {
      console.log('❌ No hay user.role en el request');
      return false;
    }

    const tieneAcceso = requiredRoles.some((role) => user.role === role);
    
    console.log('¿Tiene acceso?', tieneAcceso);
    
    return tieneAcceso;
  }
}