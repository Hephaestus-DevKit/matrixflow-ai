"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
exports.compilePrompt = compilePrompt;
// Prompt 模板渲染（Handlebars 子集，{{var}}）
function renderTemplate(template, vars) {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
        const parts = path.split('.');
        let cur = vars;
        for (const p of parts) {
            if (cur && typeof cur === 'object' && p in cur) {
                cur = cur[p];
            }
            else {
                return ''; // 缺失变量留空，由上层校验拦截
            }
        }
        return typeof cur === 'object' ? JSON.stringify(cur) : String(cur ?? '');
    });
}
function compilePrompt(systemTemplate, userTemplate, vars) {
    return {
        system: renderTemplate(systemTemplate, vars),
        user: renderTemplate(userTemplate, vars),
    };
}
//# sourceMappingURL=render.js.map