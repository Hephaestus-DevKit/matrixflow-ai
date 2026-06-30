import { WorkflowEngine, type WorkflowDSL } from '../src/index';
import { describe, it, expect } from '@jest/globals';

describe('WorkflowEngine', () => {
  const engine = new WorkflowEngine();

  it('validates a simple DAG', () => {
    const dsl: WorkflowDSL = {
      nodes: [
        { id: 'n1', type: 'trigger', config: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'ai', config: { promptKey: 'test' }, position: { x: 200, y: 0 } },
      ],
      edges: [{ source: 'n1', target: 'n2' }],
    };
    const result = engine.validate(dsl);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects missing node references', () => {
    const dsl: WorkflowDSL = {
      nodes: [{ id: 'n1', type: 'trigger', config: {}, position: { x: 0, y: 0 } }],
      edges: [{ source: 'n1', target: 'n999' }],
    };
    const result = engine.validate(dsl);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects cycles', () => {
    const dsl: WorkflowDSL = {
      nodes: [
        { id: 'n1', type: 'trigger', config: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'ai', config: {}, position: { x: 200, y: 0 } },
      ],
      edges: [{ source: 'n1', target: 'n2' }, { source: 'n2', target: 'n1' }],
    };
    const result = engine.validate(dsl);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Cycle detected');
  });

  it('rejects empty DSL', () => {
    const dsl: WorkflowDSL = { nodes: [], edges: [] };
    const result = engine.validate(dsl);
    expect(result.valid).toBe(false);
  });
});
