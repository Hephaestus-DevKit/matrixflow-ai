import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@matrixflow/db';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private prisma: PrismaService) {}

  async log(args: {
    action: string;
    userId?: string;
    organizationId?: string;
    resource?: string;
    resourceId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: unknown;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: args.action,
          userId: args.userId,
          organizationId: args.organizationId,
          resource: args.resource,
          resourceId: args.resourceId,
          ip: args.ip,
          userAgent: args.userAgent,
          metadata:
            args.metadata === undefined
              ? undefined
              : (JSON.parse(JSON.stringify(args.metadata)) as Prisma.InputJsonValue),
        },
      });
    } catch (e) {
      this.logger.warn(`audit log failed: ${(e as Error).message}`);
    }
  }
}
