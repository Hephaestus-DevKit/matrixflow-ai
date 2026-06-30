// 装饰器：声明端点所需权限，配合 PermissionsGuard
import { SetMetadata } from '@nestjs/common';
export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);
