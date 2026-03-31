/// <reference types="vite/client" />
import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

export interface GeneratedPage {
  title: string;
  html: string;
  css: string; // Tailwind classes or custom CSS if needed
}

function getAI() {
  // Use the selected API key if available, otherwise fallback to the default one
  const apiKey = 
    (window as any).process?.env?.API_KEY || 
    (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined) || 
    import.meta.env.VITE_GEMINI_API_KEY;
    
  if (!apiKey) {
    console.error("API Key do Gemini não encontrada. Verifique as variáveis de ambiente (VITE_GEMINI_API_KEY).");
  }
  
  return new GoogleGenAI({ apiKey: apiKey! });
}

function getClaudeAI() {
  const apiKey = 
    (typeof process !== 'undefined' ? process.env.CLAUDE_API_KEY : undefined) || 
    import.meta.env.VITE_CLAUDE_API_KEY;
    
  if (!apiKey) {
    return null;
  }
  
  return new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true, // Required for client-side usage in this environment
    defaultHeaders: {
      'anthropic-version': '2023-06-01'
    }
  });
}

async function callClaude(claude: Anthropic, params: any) {
  // Model priority list based on user documentation and standard availability
  const models = [
    "claude-opus-4-6",           // From user's provided documentation
    "claude-3-7-sonnet-20250219",
    "claude-3-5-sonnet-20241022", 
    "claude-3-5-sonnet-20240620", 
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307"
  ];
  let lastError = null;

  for (const model of models) {
    try {
      return await claude.messages.create({
        ...params,
        model: model
      });
    } catch (error: any) {
      lastError = error;
      // If it's a 404 (model not found), try the next one in the list
      if (error.status === 404 || (error.message && error.message.includes('not_found_error'))) {
        console.warn(`Model ${model} not found, trying fallback...`);
        continue;
      }
      // For other errors (auth, rate limit, etc.), throw immediately
      throw error;
    }
  }
  throw lastError;
}

export async function generatePage(prompt: string, modelType: 'claude' | 'gemini' = 'claude'): Promise<string> {
  const claude = getClaudeAI();
  const ai = getAI();

  if (modelType === 'claude' && claude) {
    const response = await callClaude(claude, {
      max_tokens: 8192,
      system: "Você é um web designer e desenvolvedor frontend de elite, visionário e inovador, especialista em páginas para escritórios de advocacia (Law Firms) no mercado brasileiro. Crie uma landing page de altíssima conversão, linda, perfeita e ÚNICA. Use APENAS Tailwind CSS via CDN. Retorne APENAS o conteúdo HTML para o <body>. Sem tags <html>/<body>/<head>.",
      messages: [{ role: "user", content: `Crie uma landing page de altíssima conversão, linda, perfeita e ÚNICA para: "${prompt}".
      
      DIRETRIZES CRÍTICAS DE DESIGN (Estética Premium + Inovação):
      1. FUNDAÇÃO: Mantenha a essência Dark & Gold (fundos escuros como bg-navy-900 ou bg-slate-950, acentos em dourado text-gold-500).
      2. INOVAÇÃO E CRIATIVIDADE: Use a estrutura clássica de advocacia como referência, mas INVENTE. Crie layouts assimétricos, elementos sobrepostos, grids criativos (como bento grids), glassmorphism avançado (bg-white/5 backdrop-blur-xl), e tipografia artística. Faça a página parecer uma obra de arte premiada (nível Awwwards), diferente do padrão engessado.
      3. TIPOGRAFIA: Use 'Playfair Display' (font-serif) para títulos gigantes e impactantes. Brinque com tamanhos (text-6xl a text-8xl), itálicos e pesos para criar hierarquia visual. Use 'Inter' (font-sans) para textos.
      4. HERO SECTION E CONVERSÃO: Crie um Hero section deslumbrante dividido (split layout). Lado ESQUERDO: Título de impacto, copy persuasiva e botões de CTA magnéticos (ex: 'Fale com um Especialista'). Lado DIREITO: Uma imagem imponente e profissional de um advogado ou do escritório (use a tag img com máscaras, bordas arredondadas ou recortes criativos). NÃO coloque formulário no hero, foque em botões que direcionam para o WhatsApp ou para uma seção de contato inferior. INCLUA SEMPRE um botão flutuante de WhatsApp no canto inferior direito. Faixas de "Trust" (Prova Social) abaixo do hero.
      5. IMAGENS: Use 'https://picsum.photos/seed/{keyword}/1280/720' integradas de forma criativa (masks modernas, recortes, filtros grayscale elegantes que revelam a cor no hover).
      
      REQUISITOS TÉCNICOS:
      - Use APENAS Tailwind CSS via CDN. As cores personalizadas 'navy-900', 'navy-800', 'gold-500', 'gold-600' já estão configuradas no ambiente.
      - Inclua ícones usando a tag <i data-lucide="nome-do-icone"></i> (ex: <i data-lucide="scale"></i>).
      - Retorne APENAS o conteúdo HTML para o <body>. Sem tags <html>/<body>/<head>.
      - O texto deve ser em Português do Brasil (PT-BR) com copy persuasiva, focada em segurança, confiança e autoridade.
      
      Formato de saída: Apenas a string HTML.` }]
    });
    const content = response.content[0];
    if (content.type === 'text') return content.text;
    return "";
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Você é um web designer e desenvolvedor frontend de elite, visionário e inovador, especialista em páginas para escritórios de advocacia (Law Firms) no mercado brasileiro. Crie uma landing page de altíssima conversão, linda, perfeita e ÚNICA para: "${prompt}".
    
    DIRETRIZES CRÍTICAS DE DESIGN (Estética Premium + Inovação):
    1. FUNDAÇÃO: Mantenha a essência Dark & Gold (fundos escuros como bg-navy-900 ou bg-slate-950, acentos em dourado text-gold-500).
    2. INOVAÇÃO E CRIATIVIDADE: Use a estrutura clássica de advocacia como referência, mas INVENTE. Crie layouts assimétricos, elementos sobrepostos, grids criativos (como bento grids), glassmorphism avançado (bg-white/5 backdrop-blur-xl), e tipografia artística. Faça a página parecer uma obra de arte premiada (nível Awwwards), diferente do padrão engessado.
    3. TIPOGRAFIA: Use 'Playfair Display' (font-serif) para títulos gigantes e impactantes. Brinque com tamanhos (text-6xl a text-8xl), itálicos e pesos para criar hierarquia visual. Use 'Inter' (font-sans) para textos.
    4. HERO SECTION E CONVERSÃO: Crie um Hero section deslumbrante dividido (split layout). Lado ESQUERDO: Título de impacto, copy persuasiva e botões de CTA magnéticos (ex: 'Fale com um Especialista'). Lado DIREITO: Uma imagem imponente e profissional de um advogado ou do escritório (use a tag img com máscaras, bordas arredondadas ou recortes criativos). NÃO coloque formulário no hero, foque em botões que direcionam para o WhatsApp ou para uma seção de contato inferior. INCLUA SEMPRE um botão flutuante de WhatsApp no canto inferior direito. Faixas de "Trust" (Prova Social) abaixo do hero.
    5. IMAGENS: Use 'https://picsum.photos/seed/{keyword}/1280/720' integradas de forma criativa (máscaras modernas, recortes, filtros grayscale elegantes que revelam a cor no hover).
    
    REQUISITOS TÉCNICOS:
    - Use APENAS Tailwind CSS via CDN. As cores personalizadas 'navy-900', 'navy-800', 'gold-500', 'gold-600' já estão configuradas no ambiente.
    - Inclua ícones usando a tag <i data-lucide="nome-do-icone"></i> (ex: <i data-lucide="scale"></i>).
    - Retorne APENAS o conteúdo HTML para o <body>. Sem tags <html>/<body>/<head>.
    - O texto deve ser em Português do Brasil (PT-BR) com copy persuasiva, focada em segurança, confiança e autoridade.
    
    Formato de saída: Apenas a string HTML.`,
    config: {
      temperature: 0.8,
    },
  });

  return response.text || "";
}

export async function updatePage(currentHtml: string, instruction: string, modelType: 'claude' | 'gemini' = 'claude'): Promise<string> {
  const claude = getClaudeAI();
  const ai = getAI();

  if (modelType === 'claude' && claude) {
    const response = await callClaude(claude, {
      max_tokens: 8192,
      system: "Você é um web designer de elite, visionário e inovador, focado no mercado de advocacia. Retorne APENAS o conteúdo HTML atualizado.",
      messages: [{ role: "user", content: `Aqui está o HTML atual:
      
      \`\`\`html
      ${currentHtml}
      \`\`\`
      
      Refine esta página com base em: "${instruction}". 
      
      Mantenha a base da estética premium de advocacia (Dark & Gold, tipografia Serif), mas sinta-se livre para INOVAR e criar soluções visuais únicas, modernas e deslumbrantes. Faça o design se destacar como perfeito, diferente do padrão engessado, usando layouts criativos, sobreposições e glassmorphism. O texto deve ser persuasivo em PT-BR.
      
      Retorne APENAS o conteúdo HTML atualizado.` }]
    });
    const content = response.content[0];
    if (content.type === 'text') return content.text;
    return "";
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Você é um web designer de elite, visionário e inovador, focado no mercado de advocacia. Aqui está o HTML atual:
    
    \`\`\`html
    ${currentHtml}
    \`\`\`
    
    Refine esta página com base em: "${instruction}". 
    
    Mantenha a base da estética premium de advocacia (Dark & Gold, tipografia Serif), mas sinta-se livre para INOVAR e criar soluções visuais únicas, modernas e deslumbrantes. Faça o design se destacar como perfeito, diferente do padrão engessado, usando layouts criativos, sobreposições e glassmorphism. O texto deve ser persuasivo em PT-BR.
    
    Retorne APENAS o conteúdo HTML atualizado.`,
    config: {
      temperature: 0.6,
    },
  });

  return response.text || "";
}

export async function getSuggestions(html: string): Promise<string[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Analyze this landing page HTML and suggest 3 specific stylistic or design improvements to make it more professional and high-converting.
    
    HTML:
    ${html}
    
    Return ONLY a JSON array of strings.`,
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch {
    return [];
  }
}

export async function generateImage(prompt: string): Promise<string> {
  const ai = getAI();
  // Using gemini-2.5-flash-image for better compatibility with default keys
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: prompt,
        },
      ],
    },
  });
  
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      return `data:image/png;base64,${base64EncodeString}`;
    }
  }
  throw new Error("No image generated");
}

export async function improvePrompt(prompt: string, modelType: 'claude' | 'gemini' = 'claude'): Promise<string> {
  const claude = getClaudeAI();
  const ai = getAI();

  if (modelType === 'claude' && claude) {
    const response = await callClaude(claude, {
      max_tokens: 4096,
      system: "Você é um especialista em engenharia de prompt e web design visionário, focado no mercado de advocacia. Retorne APENAS o texto do prompt melhorado.",
      messages: [{ role: "user", content: `Transforme o pedido simples abaixo em um prompt detalhado para gerar uma landing page premium, linda, perfeita e altamente inovadora para um escritório de advocacia.
      
      Pedido original: "${prompt}"
      
      O prompt melhorado deve enfatizar:
      - Estética Dark & Gold como fundação, mas com liberdade criativa para inovar (layouts assimétricos, bento grids, sobreposições elegantes).
      - Design de vanguarda, perfeito e deslumbrante (nível Awwwards), fugindo do padrão engessado.
      - Tipografia Serif elegante e artística para títulos gigantes (Playfair Display).
      - Hero section dividido: Texto persuasivo e CTAs à esquerda, e uma imagem imponente de advogado/escritório à direita (sem formulário no hero).
      - Elementos de conversão (WhatsApp flutuante, Trust badges).
      - Copywriting persuasivo em Português do Brasil (PT-BR) focado em segurança e sigilo.
      
      Retorne APENAS o texto do prompt melhorado.` }]
    });
    const content = response.content[0];
    if (content.type === 'text') return content.text;
    return prompt;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Você é um especialista em engenharia de prompt e web design visionário, focado no mercado de advocacia. Transforme o pedido simples abaixo em um prompt detalhado para gerar uma landing page premium, linda, perfeita e altamente inovadora para um escritório de advocacia.
    
    Pedido original: "${prompt}"
    
    O prompt melhorado deve enfatizar:
    - Estética Dark & Gold como fundação, mas com liberdade criativa para inovar (layouts assimétricos, bento grids, sobreposições elegantes).
    - Design de vanguarda, perfeito e deslumbrante (nível Awwwards), fugindo do padrão engessado.
    - Tipografia Serif elegante e artística para títulos gigantes (Playfair Display).
    - Hero section dividido: Texto persuasivo e CTAs à esquerda, e uma imagem imponente de advogado/escritório à direita (sem formulário no hero).
    - Elementos de conversão (WhatsApp flutuante, Trust badges).
    - Copywriting persuasivo em Português do Brasil (PT-BR) focado em segurança e sigilo.
    
    Retorne APENAS o texto do prompt melhorado.`,
    config: {
      temperature: 0.7,
    },
  });

  return response.text || prompt;
}

export async function generateDesignSystem(htmlContent: string, modelType: 'claude' | 'gemini' = 'claude'): Promise<string> {
  const claude = getClaudeAI();
  const ai = getAI();
  
  // Extract all <link> and <style> tags to preserve external CSS (Elementor, WP, etc.)
  const styleMatches = htmlContent.match(/<link[^>]+rel=["']stylesheet["'][^>]*>|<style[^>]*>[\s\S]*?<\/style>|<link[^>]+href=["'][^"']*fonts\.googleapis\.com[^"']*["'][^>]*>/gi) || [];
  const externalStyles = styleMatches.join('\n');

  // Pre-cleaning: Remove scripts, noscripts, and comments to reduce noise for AI
  let cleanedHtml = htmlContent.replace(/<script[\s\S]*?<\/script>/gi, '')
                        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
                        .replace(/<!--[\s\S]*?-->/g, '');

  // Remove only VERY large base64 images
  cleanedHtml = cleanedHtml.replace(/src="data:image\/[^;]+;base64,[^"]{10000,}"/g, 'src="[LARGE_BASE64_REMOVED]"');
  
  // Remove only VERY large SVGs
  cleanedHtml = cleanedHtml.replace(/<svg[^>]*>([\s\S]*?)<\/svg>/gi, (match) => {
    if (match.length > 15000) return '<svg>[LARGE_SVG_REMOVED]</svg>';
    return match;
  });

  if (cleanedHtml.length > 200000) {
    cleanedHtml = cleanedHtml.substring(0, 200000) + "... [TRUNCATED]";
  }

  const systemPrompt = `
# World-Class Design System Architect

You are a *Senior Design Engineer* and *CSS Specialist*. You are given the source code of a high-end website:

${cleanedHtml}

---

## THE ASSETS (MANDATORY)
You MUST include these original styles in the <head> to ensure the design isn't broken. DO NOT MODIFY THEM:
${externalStyles}

---

## THE MISSION
Build a *Premium Design System Documentation* page that is **100% faithful** to the original. 
This is NOT a summary. This is a RECONSTRUCTION of the core visual identity.

## THE GOLDEN RULES (STRICT ADHERENCE)
1. **NO SIMPLIFICATION**: If the Hero section uses complex structures (Elementor, WP, custom grids), CLONE THEM EXACTLY. Do not replace them with simple Tailwind divs.
2. **ASSET INTEGRITY**: Keep all original class names. The external CSS provided above depends on them.
3. **ICON SUPPORT**: Include common icon CDNs (FontAwesome, Lucide) in the <head>.
4. **SHOWCASE UI**: Use the provided "Showcase CSS" below for the documentation wrapper.
5. **PIXEL-PERFECT REPLICATION**: Every shadow, every border-radius, every font-size must be identical to the original.
6. **NO HALLUCINATIONS**: Do not invent new colors or styles. Use only what is in the provided HTML.
7. **IFRAME SAFETY**: If the original uses scripts that might break the preview, wrap the components in a safe way, but keep the HTML/CSS structure.
8. **INTERACTIVITY & ANIMATIONS**: Prioritize the extraction of interactive elements (hover effects, transitions, active states) and CSS animations. Ensure these are showcased in a dedicated section and function exactly as they do in the source.

---

## SHOWCASE UI (MANDATORY CSS)

Include this in the <head>:

<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  :root { --ds-accent: #C4A470; --ds-bg: #f8fafc; --ds-card: #ffffff; --ds-text: #0f172a; }
  body { background: var(--ds-bg); color: var(--ds-text); font-family: 'Inter', sans-serif; margin: 0; }
  .ds-nav { position: sticky; top: 0; z-index: 9999; background: rgba(255,255,255,0.8); backdrop-filter: blur(12px); border-bottom: 1px solid #e2e8f0; padding: 1rem; display: flex; justify-content: center; gap: 2rem; }
  .ds-nav a { color: #64748b; text-decoration: none; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; transition: 0.2s; }
  .ds-nav a:hover { color: var(--ds-accent); }
  .ds-container { max-width: 1400px; margin: 0 auto; padding: 60px 20px; }
  .ds-section-title { font-size: 28px; font-weight: 800; text-align: center; margin-bottom: 8px; letter-spacing: -0.02em; }
  .ds-section-desc { text-align: center; color: #64748b; margin-bottom: 40px; font-size: 14px; }
  .ds-divider { width: 30px; height: 2px; background: var(--ds-accent); margin: 0 auto 50px; }
  .ds-card { background: var(--ds-card); border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; margin-bottom: 40px; }
  .ds-card-header { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; background: #fafafa; }
  .ds-card-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; }
  .ds-card-body { padding: 0; }
  .ds-preview-box { padding: 40px; background: white; }
  section { scroll-margin-top: 80px; }
</style>

<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
<script src="https://unpkg.com/lucide@latest"></script>

---

## OUTPUT STRUCTURE

Build a single-page with:
1. **Hero Preview**: A 1:1 clone of the original site's hero. This MUST be the first section.
2. **Typography**: Table showing Heading levels using original classes.
3. **Colors**: Swatches from CSS variables found in the code.
4. **Components**: Buttons and Cards in their original state.
5. **Interactive Elements & Animations**: A gallery showcasing buttons, links, and other elements with their hover/active states, plus any notable CSS animations found in the source.

Return ONLY the raw HTML code. Do not include markdown blocks or any text outside the <html> tags.
    `;

  if (modelType === 'claude' && claude) {
    const response = await callClaude(claude, {
      max_tokens: 8192,
      system: "You are a World-Class Design System Architect. Build a Premium Design System Documentation page that is 100% faithful to the original. Return ONLY the raw HTML code. No markdown.",
      messages: [{ role: "user", content: systemPrompt }]
    });
    const content = response.content[0];
    if (content.type === 'text') {
      let html = content.text;
      
      // Extract content between ```html and ``` if present
      const match = html.match(/```html([\s\S]*?)```/i) || html.match(/```([\s\S]*?)```/i);
      if (match) {
        html = match[1];
      } else {
        // Fallback: remove markdown markers if they exist
        html = html.replace(/```html/gi, '').replace(/```/g, '');
      }
      
      return html.trim();
    }
    return "";
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: systemPrompt,
    config: {
      systemInstruction: "You are a World-Class Design System Architect and CSS Expert. Your task is to build a Premium Design System Documentation page that is 100% faithful to the provided HTML. You MUST replicate the original design exactly, including all complex structures and external assets. Return ONLY the raw HTML code. NO MARKDOWN.",
      temperature: 0.1,
      maxOutputTokens: 8192,
    }
  });

  let html = response.text || "";
  
  // Extract content between ```html and ``` if present
  const match = html.match(/```html([\s\S]*?)```/i) || html.match(/```([\s\S]*?)```/i);
  if (match) {
    html = match[1];
  } else {
    // Fallback: remove markdown markers if they exist
    html = html.replace(/```html/gi, '').replace(/```/g, '');
  }
  
  return html.trim();
}
