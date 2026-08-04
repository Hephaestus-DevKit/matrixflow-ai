import { Test, TestingModule } from '@nestjs/testing';
import { ContentController } from '../src/content/content.controller';
import { ContentService } from '../src/content/content.service';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('ContentController', () => {
  let controller: ContentController;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        {
          provide: ContentService,
          useValue: {
            createProject: jest.fn(),
            listProjects: jest.fn(),
            generate: jest.fn(),
            generateAll: jest.fn(),
          },
        },
      ],
    }).compile();
    controller = module.get<ContentController>(ContentController);
  });
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
