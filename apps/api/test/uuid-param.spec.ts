import { BadRequestException } from '@nestjs/common';
import { UuidParamPipe } from '../src/common/pipes/uuid-param.pipe';

describe('UuidParamPipe', () => {
  const pipe = new UuidParamPipe();

  it('rejects malformed identifier route params before they reach Prisma', () => {
    expect(() => pipe.transform('not-a-uuid', { type: 'param', data: 'itemId' })).toThrow(
      BadRequestException,
    );
  });

  it('accepts UUID params and leaves non-ID params unchanged', () => {
    const id = '87e4cd83-c6d6-4f88-b796-50e381df34ed';
    expect(pipe.transform(id, { type: 'param', data: 'id' })).toBe(id);
    expect(pipe.transform('category', { type: 'param', data: 'slug' })).toBe('category');
  });
});
