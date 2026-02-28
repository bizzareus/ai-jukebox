import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AdminRole } from '../../auth/admin.entity';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const admin = request.user;
    if (!admin || admin.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin access required');
    }
    return true;
  }
}
