// Prompt 模板渲染 (Handlebars 极简实现，避免引入额外依赖)
export type Variables = Record<string, unknown>;

export function renderTemplate(template: string, vars: Variables): string {
  return template.replace(/\{\{(\w+)(?:\s*\|\s*(\w+))?\}\}/g, (_, key: string, filter?: string) => {
    const v = vars[key];
    if (v === undefined) return '';
    if (filter === 'json') return JSON.stringify(v);
    if (filter === 'string') return String(v);
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  });
}

export interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export function compilePrompt(
  tpl: { systemPrompt: string; userPromptTemplate: string },
  vars: Variables,
): CompiledPrompt {
  return {
    systemPrompt: renderTemplate(tpl.systemPrompt, vars),
    userPrompt: renderTemplate(tpl.userPromptTemplate, vars),
  };
}
