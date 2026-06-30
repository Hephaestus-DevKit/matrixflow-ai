"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowEngine = exports.workflowDslSchema = exports.edgeSchema = exports.nodeSchema = exports.NODE_TYPES = void 0;
exports.evalExpr = evalExpr;
exports.validateDag = validateDag;
// Workflow DSL + DAG 执行器
// 对应主文档 §4.6.5 工作流引擎架构
const zod_1 = require("zod");
// 节点类型
exports.NODE_TYPES = [
    'trigger', 'ai', 'condition', 'transform', 'webhook',
    'email', 'content', 'human', 'schedule', 'loop',
];
// 节点定义
exports.nodeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.enum(exports.NODE_TYPES),
    label: zod_1.z.string().optional(),
    config: zod_1.z.record(zod_1.z.any()).default({}),
    position: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number() }),
});
// 边定义
exports.edgeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    source: zod_1.z.string(),
    target: zod_1.z.string(),
    condition: zod_1.z.string().optional(), // 表达式，用于 condition 节点分支
});
// 完整 DSL
exports.workflowDslSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    nodes: zod_1.z.array(exports.nodeSchema),
    edges: zod_1.z.array(exports.edgeSchema),
});
// 简易表达式求值（支持 $.nodeId.field 路径引用）
function evalExpr(expr, ctx) {
    // 支持 $.outputs.nodeId.field 形式
    if (expr.startsWith('$.')) {
        const path = expr.slice(2).split('.');
        let cur = ctx;
        for (const p of path) {
            if (cur && typeof cur === 'object' && p in cur) {
                cur = cur[p];
            }
            else {
                return undefined;
            }
        }
        return cur;
    }
    // 字面量
    if (expr === 'true')
        return true;
    if (expr === 'false')
        return false;
    if (!isNaN(Number(expr)))
        return Number(expr);
    return expr;
}
// DAG 拓扑校验：检测环与孤立节点
function validateDag(dsl) {
    const errors = [];
    const nodeIds = new Set(dsl.nodes.map((n) => n.id));
    if (dsl.nodes.length === 0)
        errors.push('No nodes');
    const triggers = dsl.nodes.filter((n) => n.type === 'trigger');
    if (triggers.length === 0)
        errors.push('No trigger node');
    if (triggers.length > 1)
        errors.push('Multiple trigger nodes');
    // 检测环 (DFS)
    const adj = {};
    dsl.edges.forEach((e) => {
        if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
            errors.push(`Edge references missing node: ${e.source} → ${e.target}`);
            return;
        }
        (adj[e.source] ||= []).push(e.target);
    });
    const visited = {}; // 0=未访 1=在栈 2=完成
    const dfs = (id) => {
        visited[id] = 1;
        for (const next of adj[id] || []) {
            if (visited[next] === 1)
                return true; // 环
            if (visited[next] === 0 && dfs(next))
                return true;
        }
        visited[id] = 2;
        return false;
    };
    for (const n of dsl.nodes) {
        if (visited[n.id] === 0 && dfs(n.id)) {
            errors.push('Cycle detected');
            break;
        }
    }
    return { ok: errors.length === 0, errors };
}
// 引擎：按拓扑序执行节点
class WorkflowEngine {
    executors = new Map();
    register(exec) { this.executors.set(exec.type, exec); }
    async run(dsl, ctx) {
        const validation = validateDag(dsl);
        if (!validation.ok)
            throw new Error(`Invalid DAG: ${validation.errors.join(', ')}`);
        // 从 trigger 出发，BFS 执行
        const trigger = dsl.nodes.find((n) => n.type === 'trigger');
        if (!trigger)
            throw new Error('No trigger node');
        const queue = [trigger.id];
        const executed = new Set();
        const adj = {};
        dsl.edges.forEach((e) => { (adj[e.source] ||= []).push(e.target); });
        while (queue.length > 0) {
            const nodeId = queue.shift();
            if (executed.has(nodeId))
                continue;
            const node = dsl.nodes.find((n) => n.id === nodeId);
            if (!node)
                continue;
            ctx.states[nodeId] = 'running';
            ctx.logs.push({ nodeId, level: 'info', message: `Executing ${node.type}`, ts: new Date().toISOString() });
            try {
                const executor = this.executors.get(node.type);
                if (!executor)
                    throw new Error(`No executor for type ${node.type}`);
                const out = await executor.execute(node, ctx);
                ctx.outputs[nodeId] = out;
                ctx.states[nodeId] = 'success';
                // 入队后续节点
                for (const next of adj[nodeId] || []) {
                    // condition 边检查
                    const edge = dsl.edges.find((e) => e.source === nodeId && e.target === next);
                    if (edge?.condition) {
                        const cond = evalExpr(edge.condition, ctx);
                        if (!cond) {
                            ctx.states[next] = 'skipped';
                            continue;
                        }
                    }
                    queue.push(next);
                }
            }
            catch (e) {
                ctx.states[nodeId] = 'failed';
                ctx.logs.push({ nodeId, level: 'error', message: e.message, ts: new Date().toISOString() });
                throw e;
            }
            executed.add(nodeId);
        }
        return ctx;
    }
}
exports.WorkflowEngine = WorkflowEngine;
//# sourceMappingURL=index.js.map