import { Module } from '@nestjs/common';
import { KbController } from './kb.controller';
import { KbService } from './kb.service';
import { AiModule } from '../ai/ai.module';
import { FileModule } from '../file/file.module';

@Module({
  imports: [AiModule, FileModule],
  controllers: [KbController],
  providers: [KbService],
  exports: [KbService],
})
export class KbModule {}
