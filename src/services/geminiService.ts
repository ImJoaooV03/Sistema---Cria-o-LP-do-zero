/// <reference types="vite/client" />
import { GoogleGenAI, Type } from "@google/genai";

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

export async function generatePage(prompt: string): Promise<string> {
  const ai = getAI();
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

export async function updatePage(currentHtml: string, instruction: string): Promise<string> {
  const ai = getAI();
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

export async function improvePrompt(prompt: string): Promise<string> {
  const ai = getAI();
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

export async function generateDesignSystem(htmlContent: string): Promise<string> {
  const ai = getAI();
  
  // Refined cleaning: Remove only the absolute "noise" to keep visual structure
  let cleanedHtml = htmlContent;
  
  // 1. Remove comments and scripts
  cleanedHtml = cleanedHtml.replace(/<!--[\s\S]*?-->/g, "");
  cleanedHtml = cleanedHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  
  // 2. Remove only VERY large base64 images (keep small ones/icons)
  cleanedHtml = cleanedHtml.replace(/src="data:image\/[^;]+;base64,[^"]{5000,}"/g, 'src="[LARGE_BASE64_REMOVED]"');
  
  // 3. Remove only VERY large SVGs (> 10000 chars)
  cleanedHtml = cleanedHtml.replace(/<svg[^>]*>[\s\S]*?<\/svg>/g, (match) => {
    if (match.length > 10000) return '<svg>[LARGE_SVG_REMOVED]</svg>';
    return match;
  });

  // 4. Increase limit to 120k for complex landing pages
  if (cleanedHtml.length > 120000) {
    cleanedHtml = cleanedHtml.substring(0, 120000) + "... [TRUNCATED]";
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `
# World-Class Design System Architect

You are a *Senior Design Engineer* at a top-tier agency. 
You are given the source code of a high-end website:

${cleanedHtml}

Your mission is to build a *Premium Design System Documentation* page that is **100% faithful** to the original.

---

## THE GOLDEN RULES

1. **PIXEL-PERFECT CLONING**: Do NOT simplify. If a component has complex gradients, specific shadows, or custom fonts, you MUST use the exact original HTML and classes.
2. **HERO REPLICATION**: The "Hero" section of the Design System MUST be a 1:1 clone of the site's main hero section, only changing the text to "Design System v2".
3. **STYLE INTEGRITY**: You MUST include ALL <style> blocks from the original HTML.
4. **SHOWCASE UI**: Use the provided "Showcase CSS" below to make the documentation look like a premium product.

---

## SHOWCASE UI (MANDATORY CSS)

Include this in the <head> of your generated HTML:

<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  :root { --ds-accent: #C4A470; --ds-bg: #f8fafc; --ds-card: #ffffff; --ds-text: #0f172a; }
  body { background: var(--ds-bg); color: var(--ds-text); font-family: 'Inter', sans-serif; margin: 0; }
  .ds-nav { position: sticky; top: 0; z-index: 1000; background: rgba(255,255,255,0.8); backdrop-filter: blur(12px); border-bottom: 1px solid #e2e8f0; padding: 1rem; display: flex; justify-content: center; gap: 2rem; }
  .ds-nav a { color: #64748b; text-decoration: none; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; transition: 0.2s; }
  .ds-nav a:hover { color: var(--ds-accent); }
  .ds-container { max-width: 1200px; margin: 0 auto; padding: 80px 20px; }
  .ds-section-title { font-size: 32px; font-weight: 800; text-align: center; margin-bottom: 12px; letter-spacing: -0.02em; }
  .ds-section-desc { text-align: center; color: #64748b; margin-bottom: 48px; font-size: 16px; }
  .ds-divider { width: 40px; height: 3px; background: var(--ds-accent); margin: 0 auto 60px; border-radius: 2px; }
  .ds-card { background: var(--ds-card); border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; margin-bottom: 40px; }
  .ds-card-header { padding: 20px 32px; border-bottom: 1px solid #f1f5f9; background: #fafafa; display: flex; justify-content: space-between; align-items: center; }
  .ds-card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; }
  .ds-card-body { padding: 48px; }
  .ds-token-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 24px; }
  .ds-swatch { height: 100px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.05); margin-bottom: 12px; }
  .ds-swatch-name { font-size: 14px; font-weight: 600; }
  .ds-swatch-hex { font-family: monospace; font-size: 12px; color: #94a3b8; }
  section { scroll-margin-top: 80px; }
</style>

---

## OBJECTIVE

Build a single-page Pattern Library with these sections:

1. **Hero**: 1:1 Clone of original hero (text adapted).
2. **Typography**: A clean table showing all Heading levels and Body styles using original classes.
3. **Color Palette**: Swatches of all colors found in the CSS variables.
4. **UI Components**: Buttons, Cards, and Icons shown in their original state.
5. **Motion**: A gallery showing elements with the original entrance animations.

Return ONLY the raw HTML code. No markdown, no backticks.
    `,
  });

  let html = response.text || "";
  // Robust markdown cleaning
  html = html.replace(/```html/gi, '').replace(/```/g, '').trim();
  return html;
}
