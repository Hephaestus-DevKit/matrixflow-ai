import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from '../src/agent/agent.controller';
import { AgentService } from '../src/agent/agent.service';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('AgentController', () => {
  let controller: AgentController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: { list: jest.fn(), get: jest.fn(), create: jest.fn(), run: jest.fn(), logs: jest.fn() } }],
    }).compile();
    controller = module.get<AgentController>(AgentController);
  });
  it('should be defined', () => { expect(controller).toBeDefined(); });
});
