import { GoogleGenAI, Type } from "@google/genai";

export interface GeneratedPage {
  title: string;
  html: string;
  css: string; // Tailwind classes or custom CSS if needed
}

function getAI() {
  // Use the selected API key if available, otherwise fallback to the default one
  const apiKey = (window as any).process?.env?.API_KEY || process.env.GEMINI_API_KEY;
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
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `
# Extract HTML Design System v2

You are a *Design System Showcase Builder*.
You are given a reference website HTML:

${htmlContent}

Your task is to create *one new intermediate HTML file* that acts as a *living design system + pattern library* for this exact design.

---

## GOAL

Generate *one single file* called: design-system.html and place it in the same folder of the html file.

This file must preserve the *exact look & behavior* of the reference design by *reusing the original HTML, CSS classes, animations, keyframes, transitions,effects, and layout patterns* — not approximations.

---

## HARD RULES (NON-NEGOTIABLE)

1. Do *not redesign* or invent new styles.
2. Reuse *exact class names, animations, timing, easing, hover/focus states*.
3. Reference the *same CSS/JS assets* used by the original, BUT:
4. CRITICAL: Replace any local asset paths (like \`assets/...\`) with public CDNs (e.g., Tailwind CSS \`<script src="https://cdn.tailwindcss.com"></script>\`, Iconify \`<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>\`). Ensure Tailwind CDN is included if Tailwind classes are used. ALWAYS keep all custom \`<style>\` blocks from the original HTML.
5. If a style/component is not used in the reference HTML, *do not add it*.
6. The file must be *self-explanatory by structure* (sections = documentation).
7. Include a *top horizontal nav* with anchor links to each section.

---

## OBJECTIVE

Build a *single page* composed of *canonical examples* of the design system, organized in sections.

---

## SHOWCASE STYLES (REQUIRED)

You MUST include the following CSS in the \`<head>\` of your generated HTML to style the showcase itself. You MUST use these classes (\`ds-row\`, \`swatch-inner\`, etc.) to build the showcase sections.

\`\`\`css
<style>
/* DS2 extras */
.ds-label { font-family:'Inter',sans-serif; font-size:10px; letter-spacing:.18em; text-transform:uppercase; font-weight:600; color:#888; }
.ds-token { font-family:monospace; font-size:11px; color:#999; }
.ds-row { display:flex; align-items:center; gap:16px; padding:28px 32px; background:#fff; border-bottom:1px solid #e5e7eb; }
.ds-row:hover { background:#f9fafb; }
.ds-row-name { width:160px; flex-shrink:0; }
.ds-row-preview { flex:1; }
.ds-row-spec { min-width:180px; text-align:right; font-family:monospace; font-size:11px; color:#9ca3af; }
.motion-card { border:1px solid rgba(255,255,255,.1); padding:32px; border-radius:2px; text-align:center; cursor:pointer; transition:border-color .3s; }
.motion-card:hover { border-color:#C4A470; }
.swatch-inner { height:96px; width:100%; border-radius:2px; }
.swatch-label { margin-top:10px; }
.swatch-name { display:block; font-size:13px; font-weight:500; color:#050615; }
.swatch-token { display:block; font-size:11px; color:#6b7280; font-family:monospace; }
.icon-cell { display:flex; flex-direction:column; align-items:center; gap:8px; padding:20px; color:#6b7280; transition:color .2s; }
.icon-cell:hover { color:#C4A470; }
.icon-cell span { font-size:10px; font-family:monospace; }
.layout-demo { background:#e5e7eb; padding:12px; border:2px dashed #9ca3af; font-size:12px; font-family:monospace; color:#555; }
.layout-col { background:rgba(0,0,0,.08); padding:24px; display:flex; align-items:center; justify-content:center; }
.ds-section-header { text-align:center; margin-bottom:64px; }
.ds-divider { width:64px; height:1px; background:#C4A470; margin: 16px auto; }
</style>
\`\`\`

---

### 0) Hero (Exact Clone, Text Adapted)

The *first section MUST be a direct clone of the original Hero*:

•  Same HTML structure
•  Same class names
•  Same layout
•  Same images and components
•  Same animations and interactions
•  Same buttons and background
•  Same UI components (if any)

*Allowed change (only this):*

•  Replace the hero text content to present the *Design System*
•  Keep similar text length and hierarchy

*Forbidden:*

•  Do not change layout, spacing, alignment, or animations
•  Do not add or remove elements

---

### 1) Typography

Create a *Typography section* rendered as a *spec table / vertical list*.

Each row MUST contain:

•  Style name (e.g. "Heading 1", "Bold M")
•  Live text preview using the *exact original HTML element and CSS classes*
•  Font size / line-height label aligned right (format: 40px / 48px)

Include ONLY styles that exist in the reference HTML, in this order:

•  Heading 1
•  Heading 2
•  Heading 3
•  Heading 4
•  Bold L / Bold M / Bold S
•  Paragraph (larger body, if exists)
•  Regular L / Regular M / Regular S

Rules:

•  No inline styles
•  No normalization
•  Typography, colors, spacing, and gradients MUST come from original CSS
•  If a style uses gradient text, show it exactly the same
•  If a style does not exist, do NOT include it

This section must communicate *hierarchy, scale, and rhythm* at a glance.

---

### 2) Colors & Surfaces

•  Backgrounds (page, section, card, glass/blur if exists)
•  Borders, dividers, overlays
•  Gradients (as swatches + usage context)

---

### 3) UI Components

•  Buttons, inputs, cards, etc. (only those that exist)
•  Show states side-by-side: default / hover / active / focus / disabled
•  Inputs only if present (default/focus/error if applicable)

---

### 4) Layout & Spacing

•  Containers, grids, columns, section paddings
•  Show 2–3 real layout patterns from the reference (hero layout, grid, split)

---

### 5) Motion & Interaction

Show all motion behaviors present:

•  Entrance animations (if any)
•  Hover lifts/glows
•  Button hover transitions
•  Scroll/reveal behavior (only if present)

Include a small *Motion Gallery* demonstrating each animation class.

---

### 6) Icons

If the reference uses icons:

•  Display the *same icon style/system*
•  Show size variants and color inheritance
•  Use the *same markup and classes*

If icons are not present, omit this section entirely.

Return ONLY the raw HTML code for the design system page. Do not include markdown formatting like \`\`\`html or \`\`\`.
    `,
  });

  let html = response.text || "";
  // Clean up markdown if present
  html = html.replace(/^```html\n/, '').replace(/\n```$/, '');
  return html;
}
