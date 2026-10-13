/*
 * Código compartilhado entre o criador (index.html) e a página do cartão (cartao.html).
 *
 * Como o cartão viaja:
 *   - Os dados de texto (título, mensagem, música, emojis, data…) vão compactados
 *     no próprio link, depois do "#". Assim o link abre em qualquer aparelho,
 *     sem precisar de servidor — e o conteúdo depois do "#" nunca é enviado a
 *     nenhum servidor, nem ao que hospeda a página.
 *   - As fotos são grandes demais para caber num link; ficam guardadas no
 *     aparelho onde o cartão foi criado (localStorage). Para que elas cheguem a
 *     quem recebe, troque CardStore por um backend (Supabase, Firebase etc.).
 */
(function(global){
  'use strict';

  const CARD_VERSION = 1;
  const STORE_KEY = 'floricultura:cards';

  const CATEGORIES = [
    { id:'aniversario',   label:'Aniversário',            icon:'🎂' },
    { id:'amor',          label:'Amor',                   icon:'🌹' },
    { id:'agradecimento', label:'Agradecimento',          icon:'🌼' },
    { id:'condolencias',  label:'Condolências',           icon:'🕊️' },
    { id:'so-porque-sim', label:'Só porque sim',          icon:'🌷' },
    { id:'boas-vindas',   label:'Boas-vindas / Novo lar', icon:'🌿' },
  ];

  /* ---------------- texto ---------------- */

  const HTML_ESCAPES = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
  }

  // "Joana & Marcos  2025!" -> "joana-marcos-2025"
  function slugify(str){
    return String(str || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  const secToMMSS = (s) => `${pad2(Math.floor(s / 60))}:${pad2(Math.floor(s % 60))}`;

  function findCategory(id){
    return CATEGORIES.find(c => c.id === id) || null;
  }

  /* ---------------- datas ---------------- */

  // Frase do contador de data: passado ("2 anos e 3 meses desde…"), hoje ou futuro ("Faltam 12 dias…").
  function formatDateCounter(isoDate, now = new Date()){
    if(!isoDate) return '';
    const d = new Date(isoDate + 'T00:00:00');
    if(isNaN(d)) return '';
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((today - d) / 86400000);
    const dateLabel = d.toLocaleDateString('pt-BR');

    if(diffDays === 0) return `É hoje! ${dateLabel}`;
    if(diffDays < 0){
      const n = -diffDays;
      return n === 1 ? `Falta 1 dia para ${dateLabel}` : `Faltam ${n} dias para ${dateLabel}`;
    }
    if(diffDays < 31){
      return `${diffDays} dia${diffDays === 1 ? '' : 's'} desde ${dateLabel}`;
    }

    let months = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
    if(today.getDate() < d.getDate()) months--;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const parts = [];
    if(years) parts.push(`${years} ano${years === 1 ? '' : 's'}`);
    if(rest) parts.push(`${rest} ${rest === 1 ? 'mês' : 'meses'}`);
    return `${parts.join(' e ')} desde ${dateLabel}`;
  }

  /* ---------------- link do cartão ---------------- */

  function bytesToBase64Url(bytes){
    let bin = '';
    for(let i = 0; i < bytes.length; i += 0x8000){
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlToBytes(str){
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function pipeBytes(bytes, transform){
    const stream = new Blob([bytes]).stream().pipeThrough(transform);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // Prefixo "z" = JSON comprimido (deflate); "j" = JSON puro (navegadores antigos).
  async function encodeCard(card){
    const json = new TextEncoder().encode(JSON.stringify(card));
    if(typeof CompressionStream === 'function'){
      return 'z' + bytesToBase64Url(await pipeBytes(json, new CompressionStream('deflate-raw')));
    }
    return 'j' + bytesToBase64Url(json);
  }

  async function decodeCard(token){
    if(!token || token.length < 2) return null;
    try{
      const kind = token[0];
      let bytes = base64UrlToBytes(token.slice(1));
      if(kind === 'z'){
        if(typeof DecompressionStream !== 'function') return null;
        bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
      } else if(kind !== 'j'){
        return null;
      }
      const card = JSON.parse(new TextDecoder().decode(bytes));
      return card && card.v === CARD_VERSION ? card : null;
    } catch(e){
      return null;
    }
  }

  // Endereço base da página do cartão: APP_CONFIG.PUBLIC_BASE_URL (site publicado) ou a pasta atual.
  function cardPageBase(){
    const cfg = global.APP_CONFIG || {};
    if(cfg.PUBLIC_BASE_URL) return cfg.PUBLIC_BASE_URL.replace(/\/?$/, '/') + 'cartao.html';
    return new URL('cartao.html', global.location.href).href.split('?')[0].split('#')[0];
  }

  async function buildCardUrl(card){
    return `${cardPageBase()}?c=${encodeURIComponent(card.slug)}#${await encodeCard(card)}`;
  }

  /* ---------------- armazenamento local (fotos + histórico) ---------------- */

  const CardStore = {
    _readAll(){
      try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
      catch(e){ return {}; }
    },
    get(slug){
      return this._readAll()[slug] || null;
    },
    // Retorna false se o navegador recusar (cota cheia, modo privado…).
    save(card, photos){
      const all = this._readAll();
      all[card.slug] = { card, photos: photos || [], savedAt: Date.now() };
      try{
        localStorage.setItem(STORE_KEY, JSON.stringify(all));
        return true;
      } catch(e){
        // Sem espaço: tenta salvar ao menos o cartão sem as fotos
        all[card.slug].photos = [];
        try{ localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch(e2){}
        return false;
      }
    },
  };

  function newCardId(){
    if(global.crypto && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
    return Math.random().toString(36).slice(2, 10);
  }

  global.Cartao = {
    CARD_VERSION, CATEGORIES,
    escapeHtml, slugify, secToMMSS, findCategory, formatDateCounter,
    encodeCard, decodeCard, buildCardUrl, CardStore, newCardId,
  };
})(window);
