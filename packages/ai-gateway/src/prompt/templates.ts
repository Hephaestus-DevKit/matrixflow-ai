// 25 个 Prompt 模板 seed 数据（完整版）
// 对应主文档 §9.2，每个含 system/user/inputSchema/outputSchema
// 此文件由 seed 脚本引用，也可独立运行

export const promptTemplates = [
  {
    key: 'product_title',
    name: '商品标题生成',
    category: 'ecommerce',
    systemPrompt: `你是跨境电商资深文案专家，擅长写出符合平台 SEO 规则且高转化的商品标题。
规则：
1. 严格遵守目标平台字数限制（Amazon≤200字符, Shopify≤70字符, TikTok Shop≤100字符）
2. 核心关键词前置
3. 包含品牌名（如有）+ 核心属性 + 使用场景
4. 不用全大写、不用特殊符号堆砌
5. 输出 JSON 数组`,
    userPromptTemplate: `商品资料：{{productJson|json}}
目标平台：{{platform}}
目标语言：{{language}}
品牌名：{{brand}}
请生成 5 个商品标题，每个 ≤ {{maxLength}} 字符。
输出格式：{ "titles": ["...", "...", ...] }`,
    inputSchema: { type: 'object', properties: { productJson: { type: 'object' }, platform: { type: 'string', enum: ['amazon', 'shopify', 'tiktok_shop'] }, language: { type: 'string' }, brand: { type: 'string' }, maxLength: { type: 'number' } }, required: ['productJson', 'platform', 'language'] },
    outputSchema: { type: 'object', properties: { titles: { type: 'array', items: { type: 'string' } } } },
    tags: ['ecommerce', 'amazon', 'shopify', 'tiktok'],
  },
  {
    key: 'product_listing',
    name: '商品详情页/Listing',
    category: 'ecommerce',
    systemPrompt: `你是跨境电商 Listing 专家，写出高转化的商品详情页。
结构：标题 → 卖卖点（5个bullet points）→ 详细描述 → 规格表 → 适用场景
语气：专业但不生硬，突出用户利益而非产品功能
输出 JSON`,
    userPromptTemplate: `商品：{{productJson|json}}
平台：{{platform}}
语言：{{language}}
输出格式：{ "title": "", "bulletPoints": ["..."], "description": "", "specifications": {}, "useCases": [""] }`,
    inputSchema: { type: 'object', properties: { productJson: { type: 'object' }, platform: { type: 'string' }, language: { type: 'string' } }, required: ['productJson', 'platform', 'language'] },
    outputSchema: { type: 'object', properties: { title: { type: 'string' }, bulletPoints: { type: 'array' }, description: { type: 'string' }, specifications: { type: 'object' }, useCases: { type: 'array' } } },
    tags: ['ecommerce', 'listing'],
  },
  {
    key: 'product_faq',
    name: '商品 FAQ',
    category: 'ecommerce',
    systemPrompt: `你是电商客服专家，根据商品信息生成 10 个常见问题及专业回答。回答要简洁、准确、有助转化。输出 JSON。`,
    userPromptTemplate: `商品：{{productJson|json}}
语言：{{language}}
输出：{ "faqs": [{ "q": "", "a": "" }] }`,
    inputSchema: { type: 'object', properties: { productJson: { type: 'object' }, language: { type: 'string' } }, required: ['productJson', 'language'] },
    outputSchema: { type: 'object', properties: { faqs: { type: 'array', items: { type: 'object', properties: { q: { type: 'string' }, a: { type: 'string' } } } } } },
    tags: ['ecommerce', 'faq'],
  },
  {
    key: 'tiktok_script',
    name: 'TikTok 短视频脚本',
    category: 'social',
    systemPrompt: `你是 TikTok 爆款脚本编剧。
结构：前3秒钩子（制造好奇/痛点/反差）→ 痛点放大 → 产品展示 → 效果证明 → CTA
每幕标注：秒数、旁白、画面动作、屏幕文字
输出 JSON`,
    userPromptTemplate: `商品：{{productJson|json}}
目标受众：{{audience}}
时长：{{duration}}秒
语言：{{language}}
输出：{ "hook": "", "scenes": [{ "second": 0, "voiceover": "", "action": "", "text": "" }], "cta": "" }`,
    inputSchema: { type: 'object', properties: { productJson: { type: 'object' }, audience: { type: 'string' }, duration: { type: 'number' }, language: { type: 'string' } }, required: ['productJson', 'audience', 'duration'] },
    outputSchema: { type: 'object', properties: { hook: { type: 'string' }, scenes: { type: 'array' }, cta: { type: 'string' } } },
    tags: ['tiktok', 'video', 'script'],
  },
  {
    key: 'instagram_caption',
    name: 'Instagram 文案',
    category: 'social',
    systemPrompt: `你是 Instagram 文案高手。写出带 emoji、有故事感、带 10+ 个相关 hashtag 的文案。CTA 自然融入。输出 JSON。`,
    userPromptTemplate: `商品：{{productJson|json}}
风格：{{style}}
语言：{{language}}
输出：{ "caption": "", "hashtags": [""] }`,
    inputSchema: { type: 'object', properties: { productJson: { type: 'object' }, style: { type: 'string' }, language: { type: 'string' } }, required: ['productJson'] },
    outputSchema: { type: 'object', properties: { caption: { type: 'string' }, hashtags: { type: 'array' } } },
    tags: ['instagram', 'social'],
  },
  {
    key: 'facebook_ad',
    name: 'Facebook 广告文案',
    category: 'ad',
    systemPrompt: `你是 Facebook 广告优化师。写出主标题(≤40字符)+正文(≤125字符)+描述(≤30字符)，符合 FB 政策，不含夸大医疗/金融承诺。输出 JSON。`,
    userPromptTemplate: `商品：{{productJson|json}}
目标受众：{{audience}}
目标：{{objective}}
语言：{{language}}
输出：{ "headline": "", "body": "", "description": "", "cta": "" }`,
    inputSchema: { type: 'object', properties: { productJson: { type: 'object' }, audience: { type: 'string' }, objective: { type: 'string' }, language: { type: 'string' } }, required: ['productJson'] },
    outputSchema: { type: 'object', properties: { headline: { type: 'string' }, body: { type: 'string' }, description: { type: 'string' }, cta: { type: 'string' } } },
    tags: ['facebook', 'ad'],
  },
  {
    key: 'google_ads',
    name: 'Google Ads 文案',
    category: 'ad',
    systemPrompt: `你是 Google Ads 专家。标题≤30字符×3，描述≤90字符×2。关键词自然嵌入。输出 JSON。`,
    userPromptTemplate: `商品：{{productJson|json}}
关键词：{{keywords}}
语言：{{language}}
输出：{ "headlines": ["","",""], "descriptions": ["",""] }`,
    inputSchema: { type: 'object', properties: { productJson: { type: 'object' }, keywords: { type: 'string' }, language: { type: 'string' } }, required: ['productJson', 'keywords'] },
    outputSchema: { type: 'object', properties: { headlines: { type: 'array' }, descriptions: { type: 'array' } } },
    tags: ['google', 'ad'],
  },
  {
    key: 'email_marketing',
    name: '邮件营销内容',
    category: 'email',
    systemPrompt: `你是邮件营销文案专家。写出主题行(≤50字符)+预览文本+正文(HTML友好)+CTA按钮文字。语气友好专业。输出 JSON。`,
    userPromptTemplate: `商品/活动：{{productJson|json}}
邮件类型：{{emailType}}
受众：{{audience}}
语言：{{language}}
输出：{ "subject": "", "preview": "", "body": "", "cta": "" }`,
    inputSchema: { type: 'object', properties: { productJson: { type: 'object' }, emailType: { type: 'string' }, audience: { type: 'string' }, language: { type: 'string' } }, required: ['productJson', 'emailType'] },
    outputSchema: { type: 'object', properties: { subject: { type: 'string' }, preview: { type: 'string' }, body: { type: 'string' }, cta: { type: 'string' } } },
    tags: ['email', 'marketing'],
  },
  {
    key: 'seo_blog',
    name: 'SEO 博客文章',
    category: 'content',
    systemPrompt: `你是 SEO 内容专家。写 1500-2000 字博客，关键词自然分布(1-2%密度)，H2/H3 结构清晰，内链建议，meta description≤160字符。输出 JSON。`,
    userPromptTemplate: `主题：{{topic}}
关键词：{{keywords}}
目标受众：{{audience}}
语言：{{language}}
输出：{ "title": "", "metaDescription": "", "headings": [{ "level": 2, "text": "" }], "content": "", "internalLinks": [""] }`,
    inputSchema: { type: 'object', properties: { topic: { type: 'string' }, keywords: { type: 'string' }, audience: { type: 'string' }, language: { type: 'string' } }, required: ['topic', 'keywords'] },
    outputSchema: { type: 'object', properties: { title: { type: 'string' }, metaDescription: { type: 'string' }, headings: { type: 'array' }, content: { type: 'string' }, internalLinks: { type: 'array' } } },
    tags: ['seo', 'blog'],
  },
  {
    key: 'customer_service_reply',
    name: '客服自动回复',
    category: 'support',
    systemPrompt: `你是专业客服。根据对话历史和知识库，生成礼貌、准确、有同理心的回复。若无法确定答案，建议转人工。输出 JSON。`,
    userPromptTemplate: `对话历史：{{history}}
客户姓名：{{customerName}}
知识库上下文：{{context}}
输出：{ "reply": "", "confidence": 0.0, "suggestEscalate": false }`,
    inputSchema: { type: 'object', properties: { history: { type: 'string' }, customerName: { type: 'string' }, context: { type: 'string' } }, required: ['history'] },
    outputSchema: { type: 'object', properties: { reply: { type: 'string' }, confidence: { type: 'number' }, suggestEscalate: { type: 'boolean' } } },
    tags: ['support', 'customer_service'],
  },
  {
    key: 'negative_review_reply',
    name: '差评回复',
    category: 'support',
    systemPrompt: `你是品牌公关专家。写差评回复：先道歉→承认问题→提供解决方案→邀请私下联系。语气真诚不敷衍。输出 JSON。`,
    userPromptTemplate: `差评内容：{{review}}
商品：{{productJson|json}}
品牌：{{brand}}
输出：{ "reply": "" }`,
    inputSchema: { type: 'object', properties: { review: { type: 'string' }, productJson: { type: 'object' }, brand: { type: 'string' } }, required: ['review'] },
    outputSchema: { type: 'object', properties: { reply: { type: 'string' } } },
    tags: ['support', 'review'],
  },
  {
    key: 'multilingual_translate',
    name: '多语言翻译',
    category: 'translation',
    systemPrompt: `你是专业翻译。保持原文语气、品牌术语一致、本地化表达（非直译）。输出 JSON。`,
    userPromptTemplate: `原文：{{sourceText}}
源语言：{{sourceLanguage}}
目标语言：{{targetLanguage}}
领域：{{domain}}
输出：{ "translation": "" }`,
    inputSchema: { type: 'object', properties: { sourceText: { type: 'string' }, sourceLanguage: { type: 'string' }, targetLanguage: { type: 'string' }, domain: { type: 'string' } }, required: ['sourceText', 'sourceLanguage', 'targetLanguage'] },
    outputSchema: { type: 'object', properties: { translation: { type: 'string' } } },
    tags: ['translation', 'multilingual'],
  },
  {
    key: 'brand_voice_rewrite',
    name: '品牌语气改写',
    category: 'brand',
    systemPrompt: `你是品牌语气专家。按品牌规范改写内容，保持信息不变但语气/用词/emoji 使用符合品牌指南。输出 JSON。`,
    userPromptTemplate: `原文：{{sourceText}}
品牌语气规则：{{brandVoiceRules|json}}
输出：{ "rewritten": "" }`,
    inputSchema: { type: 'object', properties: { sourceText: { type: 'string' }, brandVoiceRules: { type: 'object' } }, required: ['sourceText', 'brandVoiceRules'] },
    outputSchema: { type: 'object', properties: { rewritten: { type: 'string' } } },
    tags: ['brand', 'rewrite'],
  },
  {
    key: 'brand_voice_extract',
    name: '品牌语气提取',
    category: 'brand',
    systemPrompt: `从品牌样本文本中提取语气特征：正式度(1-5)、幽默度(1-5)、emoji使用频率、禁用词、口头禅。输出 JSON。`,
    userPromptTemplate: `样本文本：{{sampleTexts}}
品牌名：{{brandName}}
输出：{ "formality": 3, "humor": 2, "emojiFrequency": "low", "bannedWords": [], "catchphrases": [], "toneDescription": "" }`,
    inputSchema: { type: 'object', properties: { sampleTexts: { type: 'string' }, brandName: { type: 'string' } }, required: ['sampleTexts'] },
    outputSchema: { type: 'object', properties: { formality: { type: 'number' }, humor: { type: 'number' }, emojiFrequency: { type: 'string' }, bannedWords: { type: 'array' }, catchphrases: { type: 'array' }, toneDescription: { type: 'string' } } },
    tags: ['brand'],
  },
  {
    key: 'content_score',
    name: '内容评分',
    category: 'evaluation',
    systemPrompt: `你是内容质量评审。按维度评分(0-100)并给出理由：SEO、可读性、转化力、品牌契合度。输出 JSON。`,
    userPromptTemplate: `内容：{{content}}
维度：{{dimension}}
品牌规范：{{brandVoiceRules|json}}
输出：{ "score": 0, "reason": "", "suggestions": [""] }`,
    inputSchema: { type: 'object', properties: { content: { type: 'string' }, dimension: { type: 'string' }, brandVoiceRules: { type: 'object' } }, required: ['content', 'dimension'] },
    outputSchema: { type: 'object', properties: { score: { type: 'number' }, reason: { type: 'string' }, suggestions: { type: 'array' } } },
    tags: ['evaluation', 'score'],
  },
  {
    key: 'rag_qa',
    name: 'RAG 问答',
    category: 'rag',
    systemPrompt: `你是知识库问答助手。只依据提供的上下文回答，若上下文无答案请明说"未在知识库中找到"。引用来源编号 [docN]。输出 JSON。`,
    userPromptTemplate: `上下文：{{context}}
问题：{{question}}
输出：{ "answer": "", "citations": [{ "docId": "", "snippet": "" }] }`,
    inputSchema: { type: 'object', properties: { context: { type: 'string' }, question: { type: 'string' } }, required: ['context', 'question'] },
    outputSchema: { type: 'object', properties: { answer: { type: 'string' }, citations: { type: 'array' } } },
    tags: ['rag', 'qa'],
  },
  {
    key: 'conversation_summary',
    name: '对话总结',
    category: 'crm',
    systemPrompt: `总结客服对话：客户问题、解决方案、是否解决、后续建议。输出 JSON。`,
    userPromptTemplate: `对话历史：{{history}}
输出：{ "summary": "", "resolved": true, "followUp": "" }`,
    inputSchema: { type: 'object', properties: { history: { type: 'string' } }, required: ['history'] },
    outputSchema: { type: 'object', properties: { summary: { type: 'string' }, resolved: { type: 'boolean' }, followUp: { type: 'string' } } },
    tags: ['crm', 'summary'],
  },
  {
    key: 'customer_profile',
    name: '客户画像',
    category: 'crm',
    systemPrompt: `根据客户信息和交互历史，生成客户画像：购买力、偏好、活跃度、生命周期阶段。输出 JSON。`,
    userPromptTemplate: `客户数据：{{customerData|json}}
交互历史：{{interactions}}
输出：{ "spendingLevel": "", "preferences": [], "activityLevel": "", "lifecycleStage": "", "insights": "" }`,
    inputSchema: { type: 'object', properties: { customerData: { type: 'object' }, interactions: { type: 'string' } }, required: ['customerData'] },
    outputSchema: { type: 'object', properties: { spendingLevel: { type: 'string' }, preferences: { type: 'array' }, activityLevel: { type: 'string' }, lifecycleStage: { type: 'string' }, insights: { type: 'string' } } },
    tags: ['crm', 'profile'],
  },
  {
    key: 'sales_followup',
    name: '销售跟进建议',
    category: 'crm',
    systemPrompt: `根据线索状态和交互历史，建议下一步跟进动作、时间、话术。输出 JSON。`,
    userPromptTemplate: `线索：{{leadData|json}}
历史：{{history}}
输出：{ "action": "", "timing": "", "script": "", "priority": "high" }`,
    inputSchema: { type: 'object', properties: { leadData: { type: 'object' }, history: { type: 'string' } }, required: ['leadData'] },
    outputSchema: { type: 'object', properties: { action: { type: 'string' }, timing: { type: 'string' }, script: { type: 'string' }, priority: { type: 'string' } } },
    tags: ['crm', 'sales'],
  },
  {
    key: 'landing_page_copy',
    name: '落地页文案',
    category: 'content',
    systemPrompt: `你是高转化落地页文案专家。结构：Hero(标题+副标题+CTA) → 痛点 → 解决方案 → 社会证明 → 功能列表 → 最终CTA。输出 JSON。`,
    userPromptTemplate: `产品：{{productJson|json}}
目标受众：{{audience}}
语言：{{language}}
输出：{ "hero": { "title": "", "subtitle": "", "cta": "" }, "painPoints": [""], "solution": "", "socialProof": [""], "features": [{ "title": "", "desc": "" }], "finalCta": "" }`,
    inputSchema: { type: 'object', properties: { productJson: { type: 'object' }, audience: { type: 'string' }, language: { type: 'string' } }, required: ['productJson'] },
    outputSchema: { type: 'object', properties: { hero: { type: 'object' }, painPoints: { type: 'array' }, solution: { type: 'string' }, socialProof: { type: 'array' }, features: { type: 'array' }, finalCta: { type: 'string' } } },
    tags: ['landing_page', 'copy'],
  },
  {
    key: 'data_analysis',
    name: '数据分析洞察',
    category: 'analytics',
    systemPrompt: `你是数据分析师。从数据中提取关键洞察、趋势、异常值、行动建议。输出 JSON。`,
    userPromptTemplate: `数据：{{data|json}}
分析维度：{{dimensions}}
输出：{ "insights": [""], "trends": [""], "anomalies": [""], "recommendations": [""] }`,
    inputSchema: { type: 'object', properties: { data: { type: 'object' }, dimensions: { type: 'string' } }, required: ['data'] },
    outputSchema: { type: 'object', properties: { insights: { type: 'array' }, trends: { type: 'array' }, anomalies: { type: 'array' }, recommendations: { type: 'array' } } },
    tags: ['analytics', 'data'],
  },
  {
    key: 'daily_brief',
    name: '老板日报',
    category: 'analytics',
    systemPrompt: `你是运营日报生成器。汇总：昨日关键指标、环比变化、异常提醒、今日重点。语气简洁高管风。输出 JSON。`,
    userPromptTemplate: `指标数据：{{metrics|json}}
日期：{{date}}
输出：{ "headline": "", "metrics": [{ "name": "", "value": "", "change": "" }], "alerts": [""], "focus": [""] }`,
    inputSchema: { type: 'object', properties: { metrics: { type: 'object' }, date: { type: 'string' } }, required: ['metrics'] },
    outputSchema: { type: 'object', properties: { headline: { type: 'string' }, metrics: { type: 'array' }, alerts: { type: 'array' }, focus: { type: 'array' } } },
    tags: ['analytics', 'daily'],
  },
  {
    key: 'workflow_generate',
    name: '工作流生成',
    category: 'workflow',
    systemPrompt: `你是工作流设计专家。根据用户描述生成工作流 DSL（节点+边）。输出 JSON。`,
    userPromptTemplate: `描述：{{description}}
业务场景：{{scenario}}
输出：{ "nodes": [{ "id": "", "type": "", "config": {} }], "edges": [{ "source": "", "target": "" }] }`,
    inputSchema: { type: 'object', properties: { description: { type: 'string' }, scenario: { type: 'string' } }, required: ['description'] },
    outputSchema: { type: 'object', properties: { nodes: { type: 'array' }, edges: { type: 'array' } } },
    tags: ['workflow', 'generate'],
  },
  {
    key: 'safety_audit',
    name: '内容安全审核',
    category: 'safety',
    systemPrompt: `你是内容安全审核员。检测：暴力/色情/政治敏感/虚假宣传/歧视/隐私泄露。输出风险等级和理由。输出 JSON。`,
    userPromptTemplate: `内容：{{content}}
输出：{ "safe": true, "riskLevel": "low", "flags": [{ "type": "", "reason": "" }], "suggestion": "" }`,
    inputSchema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
    outputSchema: { type: 'object', properties: { safe: { type: 'boolean' }, riskLevel: { type: 'string' }, flags: { type: 'array' }, suggestion: { type: 'string' } } },
    tags: ['safety', 'audit'],
  },
  {
    key: 'agent_system_prompt',
    name: 'AI 员工系统 Prompt 生成',
    category: 'agent',
    systemPrompt: `你是 AI 员工设计专家。根据角色、技能、行业，生成完整的系统 Prompt。输出 JSON。`,
    userPromptTemplate: `角色：{{role}}
技能：{{skills}}
行业：{{industry}}
语气：{{tone}}
输出：{ "systemPrompt": "", "suggestedSkills": [""], "suggestedTools": [""] }`,
    inputSchema: { type: 'object', properties: { role: { type: 'string' }, skills: { type: 'string' }, industry: { type: 'string' }, tone: { type: 'string' } }, required: ['role'] },
    outputSchema: { type: 'object', properties: { systemPrompt: { type: 'string' }, suggestedSkills: { type: 'array' }, suggestedTools: { type: 'array' } } },
    tags: ['agent', 'prompt'],
  },
];
