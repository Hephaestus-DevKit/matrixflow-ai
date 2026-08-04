import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { uuidSchema } from '@matrixflow/shared';

@Injectable()
export class UuidParamPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (
      metadata.type !== 'param' ||
      !metadata.data ||
      !/id$/i.test(metadata.data) ||
      typeof value !== 'string'
    ) {
      return value;
    }
    const parsed = uuidSchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException(`${metadata.data} must be a UUID`);
    return parsed.data;
  }
}
