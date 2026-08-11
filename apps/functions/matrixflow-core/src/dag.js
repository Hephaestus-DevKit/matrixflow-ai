const MAX_NODES = 100;
const MAX_EDGES = 300;
const NODE_TYPES = new Set(['trigger', 'ai', 'transform', 'condition', 'email', 'webhook']);

export class DagValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DagValidationError';
    this.code = 'INVALID_WORKFLOW';
    this.status = 400;
  }
}

export function validateDag(value) {
  if (!value || typeof value !== 'object') throw new DagValidationError('工作流配置必须是对象');
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];
  const edges = Array.isArray(value.edges) ? value.edges : [];
  if (nodes.length === 0) throw new DagValidationError('工作流至少需要一个节点');
  if (nodes.length > MAX_NODES) throw new DagValidationError(`工作流节点不能超过 ${MAX_NODES} 个`);
  if (edges.length > MAX_EDGES) throw new DagValidationError(`工作流连接不能超过 ${MAX_EDGES} 条`);

  const ids = new Set();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(node.id)) {
      throw new DagValidationError('节点 ID 只能包含字母、数字、下划线和短横线');
    }
    if (ids.has(node.id)) throw new DagValidationError(`节点 ID 重复：${node.id}`);
    if (!NODE_TYPES.has(node.type)) throw new DagValidationError(`不支持的节点类型：${node.type}`);
    ids.add(node.id);
  }

  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!edge || !ids.has(edge.source) || !ids.has(edge.target)) {
      throw new DagValidationError('连接引用了不存在的节点');
    }
    if (edge.source === edge.target) throw new DagValidationError('节点不能连接到自身');
    incoming.set(edge.target, incoming.get(edge.target) + 1);
    outgoing.get(edge.source).push(edge.target);
  }

  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const target of outgoing.get(id)) {
      incoming.set(target, incoming.get(target) - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
  }
  if (order.length !== nodes.length) throw new DagValidationError('工作流存在循环依赖');
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return { nodes, edges, order: order.map((id) => byId.get(id)) };
}

export function interpolate(template, values) {
  const text = typeof template === 'string' ? template : JSON.stringify(template ?? '');
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, path) => {
    const value = path.split('.').reduce((current, key) => current?.[key], values);
    return value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  });
}

export function readPath(values, path) {
  if (!path) return values;
  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => current?.[key], values);
}

function comparable(value) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  if (normalized === 'null') return null;
  if (normalized !== '' && Number.isFinite(Number(normalized))) return Number(normalized);
  return value;
}

export function evaluateCondition(config = {}, values = {}) {
  const actual = comparable(readPath(values, config.field || 'input'));
  const expected = comparable(config.value);
  switch (config.operator || 'truthy') {
    case 'eq':
      return actual === expected;
    case 'ne':
      return actual !== expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'contains':
      return String(actual ?? '').includes(String(expected ?? ''));
    case 'falsy':
      return !Boolean(actual);
    case 'truthy':
      return Boolean(actual);
    default:
      throw new DagValidationError(`不支持的条件操作符：${config.operator}`);
  }
}

export function edgeAllows(edge, sourceOutput) {
  const condition = edge?.condition || 'always';
  if (condition === 'always') return true;
  if (condition === 'true' || condition === 'truthy') return Boolean(sourceOutput);
  if (condition === 'false' || condition === 'falsy') return !Boolean(sourceOutput);
  throw new DagValidationError(`不支持的连接条件：${condition}`);
}
