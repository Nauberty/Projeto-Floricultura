// Criador do cartão (index.html): assistente, prévia, música e link final.
(function(){

  // Chave da YouTube Data API v3 — definida em config.js (fora do git). Sem ela, usa noembed.com.
  const YT_API_KEY = (window.APP_CONFIG && window.APP_CONFIG.YOUTUBE_API_KEY) || '';

  const { CATEGORIES, escapeHtml, slugify, secToMMSS, formatDateCounter, buildCardUrl, CardStore, newCardId } = window.Cartao;
  const DRAFT_KEY = 'floricultura:draft';

  const state = {
    id: newCardId(),
    slugRaw: '',
    slug: '',
    title: '',
    senderName: '',   // nome completo do comprador (assina o cartão)
    buyerEmail: '',
    buyerPhone: '',
    category: '',
    hasDate: false,
    eventDate: '',
    message: '',
    msgStyle: 'sans',
    photos: [],
    emojis: [],
    music: null // { videoId, url, start(seconds), duration(seconds), title }
  };

  const EMOJIS = ['🌸','🌹','🌻','🌷','🌺','💐','🍃','✨','💛','🤍'];

  const STEPS = [
    { key:'slug', label:'Nome da Página' },
    { key:'title', label:'Título do Cartão' },
    { key:'contact', label:'De quem é' },
    { key:'category', label:'Categoria' },
    { key:'date', label:'Data Especial' },
    { key:'message', label:'Mensagem' },
    { key:'photos', label:'Fotos' },
    { key:'emoji', label:'Selo / Emoji' },
    { key:'music', label:'Música' },
    { key:'final', label:'Link Pronto' },
  ];
  const FINAL_INDEX = STEPS.length - 1;

  let current = 0;

  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(html !== undefined) e.innerHTML = html;
    return e;
  };

  function extractYouTubeId(url){
    if(!url) return null;
    const re = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const m = url.match(re);
    return m ? m[1] : null;
  }

  /* ---------------- TRACKER ---------------- */
  function renderTracker(){
    const t = document.getElementById('tracker');
    t.innerHTML = '';
    STEPS.forEach((s, i) => {
      const node = el('div','step-node');
      if(i < current) node.classList.add('done');
      if(i === current) node.classList.add('active');
      node.innerHTML = `<div class="dot"><span>${i+1}</span></div><div class="step-label">${s.label}</div>`;
      node.style.cursor = i <= current ? 'pointer' : 'default';
      node.addEventListener('click', () => { if(i <= current){ current = i; render(); }});
      t.appendChild(node);
    });
  }

  /* ---------------- SPRIG (progress signature) ---------------- */
  const leafPaths = [
    "M140 8c-8 4-15 9-19 16c8-2 15-1 19 3c1-8 1-14 0-19Z",
    "M118 34c-9 1-17 4-23 10c8 0 15 2 19 7c3-6 4-12 4-17Z",
    "M100 55c-9-1-18 0-25 5c7 2 13 6 16 11c4-5 7-10 9-16Z",
    "M87 76c-9-3-18-3-26 0c6 4 11 9 13 14c5-4 9-9 13-14Z",
    "M90 90c-8-4-17-6-25-4c5 5 9 11 10 16c6-3 11-7 15-12Z",
    "M96 100c-6-6-14-9-22-9c3 6 5 12 5 18c6-2 12-5 17-9Z",
    "M105 108c-5-7-12-11-20-12c2 6 3 13 1 18c7-1 14-3 19-6Z",
    "M112 118c-3-8-9-13-16-15c0 6 0 13-3 18c7 0 14-1 19-3Z",
    "M118 128c-1-8-6-14-12-18c-1 7-3 13-7 18c6 1 13 1 19 0Z",
    "M124 137c0-9-4-16-11-21c-2 7-6 13-11 17c7 3 15 5 22 4Z",
  ];
  function renderSprig(){
    const g = document.getElementById('sprig-leaves');
    g.innerHTML = '';
    leafPaths.forEach((d, i) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg','path');
      p.setAttribute('d', d);
      const done = i <= current;
      p.setAttribute('fill', i % 3 === 0 ? '#C97B84' : (i % 3 === 1 ? '#6E7F5C' : '#B08947'));
      p.style.opacity = done ? '1' : '0';
      p.style.transform = done ? 'scale(1)' : 'scale(0.4)';
      p.style.transformOrigin = 'center';
      g.appendChild(p);
    });
  }

  /* ---------------- STEP RENDERERS ---------------- */
  function wrap(title, desc, bodyHtml){
    return `
      <div class="step-eyebrow">Passo ${current+1} de ${STEPS.length}</div>
      <h2 class="step-title">${title}</h2>
      <p class="step-desc">${desc}</p>
      ${bodyHtml}
    `;
  }

  function renderStepContent(){
    if(musicUI){ musicUI.destroy(); musicUI = null; }
    const c = document.getElementById('step-content');
    let html = '';

    if(current === 0){
      html = wrap('Nome da Página',
        'Escolha o endereço único do seu cartão — é o que vai aparecer no link enviado.',
        `
        <div class="field">
          <input type="text" id="inpSlug" maxlength="80" placeholder="Ex: Joana e Marcos" value="${escapeHtml(state.slugRaw)}">
        </div>
        <div class="hint" id="slugCount">0/60 caracteres</div>
        <div class="hint" id="slugResult"></div>
        <div class="hint error" id="stepError" role="alert"></div>
        `);
    }

    if(current === 1){
      html = wrap('Título do Cartão',
        'O título que vai aparecer em destaque, logo no topo do cartão.',
        `
        <div class="field">
          <input type="text" id="inpTitle" maxlength="80" placeholder="Ex: Feliz Aniversário, Ana!" value="${escapeHtml(state.title)}">
        </div>
        <div class="hint" id="titleCount">0/80 caracteres</div>
        <div class="hint error" id="stepError" role="alert"></div>
        `);
    }

    if(current === 2){
      html = wrap('De quem é este cartão',
        'Preencha seus dados de comprador. Assim quem recebe sabe quem enviou o carinho, e a floricultura consegue falar com você sobre o pedido.',
        `
        <form class="buyer-form" id="buyerForm" novalidate>
          <div class="field">
            <label class="field-label" for="inpBuyerName">Nome completo <span class="req" aria-hidden="true">*</span></label>
            <input type="text" id="inpBuyerName" name="name" autocomplete="name" maxlength="80" required
              placeholder="Ex: Marcos Oliveira" aria-describedby="errBuyerName" value="${escapeHtml(state.senderName)}">
            <div class="field-error" id="errBuyerName" role="alert"></div>
          </div>
          <div class="row2">
            <div class="field">
              <label class="field-label" for="inpBuyerEmail">E-mail <span class="req" aria-hidden="true">*</span></label>
              <input type="email" id="inpBuyerEmail" name="email" autocomplete="email" inputmode="email" maxlength="120" required
                placeholder="voce@email.com" aria-describedby="errBuyerEmail" value="${escapeHtml(state.buyerEmail)}">
              <div class="field-error" id="errBuyerEmail" role="alert"></div>
            </div>
            <div class="field">
              <label class="field-label" for="inpBuyerPhone">Telefone / WhatsApp <span class="req" aria-hidden="true">*</span></label>
              <input type="tel" id="inpBuyerPhone" name="phone" autocomplete="tel-national" inputmode="tel" maxlength="15" required
                placeholder="(11) 91234-5678" aria-describedby="errBuyerPhone" value="${escapeHtml(state.buyerPhone)}">
              <div class="field-error" id="errBuyerPhone" role="alert"></div>
            </div>
          </div>
        </form>
        <div class="hint"><span class="req">*</span> Campos obrigatórios. Seu nome assina o cartão. O e-mail e o telefone ficam só com a floricultura: eles não vão no link e não aparecem para quem recebe.</div>
        `);
    }

    if(current === 3){
      html = wrap('Categoria',
        'Isso ajusta o tom do cartão e sugere flores combinando com a ocasião.',
        `<div class="chip-grid" id="catGrid"></div>`);
    }

    if(current === 4){
      html = wrap('Data Especial',
        'Quer mostrar um contador no cartão? Datas passadas mostram "há quanto tempo" (ex: 3 anos juntos); datas futuras mostram quanto falta.',
        `
        <div class="toggle-row">
          <div class="switch ${state.hasDate ? 'on':''}" id="dateSwitch"></div>
          <span class="toggle-label">Mostrar contador de data no cartão</span>
        </div>
        <div class="field date-field" id="dateField"${state.hasDate ? '' : ' hidden'}>
          <label class="field-label">Data de referência</label>
          <input type="date" id="inpDate" value="${escapeHtml(state.eventDate)}">
          <div class="hint">O cartão calcula o contador automaticamente no dia em que for aberto.</div>
        </div>
        `);
    }

    if(current === 5){
      html = wrap('Mensagem',
        'Escreva o recado com carinho. Você também escolhe o estilo da letra.',
        `
        <div class="style-pill-row">
          <div class="style-pill" data-style="sans">Padrão</div>
          <div class="style-pill" data-style="serif">Elegante</div>
          <div class="style-pill" data-style="script">Manuscrita</div>
        </div>
        <div class="field">
          <textarea id="inpMessage" maxlength="400" placeholder="Escreva sua mensagem...">${escapeHtml(state.message)}</textarea>
        </div>
        <div class="charcount" id="msgCount">0/400 caracteres</div>
        `);
    }

    if(current === 6){
      html = wrap('Fotos',
        'Adicione até 4 fotos para acompanhar o cartão. A primeira aparece em destaque.',
        `
        <div class="dropzone" id="dropzone" role="button" tabindex="0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4M12 4l-4 4M12 4l4 4"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>
          <p><strong>Clique para enviar</strong> ou arraste as fotos aqui</p>
        </div>
        <input type="file" id="fileInput" accept="image/*" multiple hidden>
        <div class="thumbs" id="thumbs"></div>
        <div class="hint error" id="stepError" role="alert"></div>
        `);
    }

    if(current === 7){
      html = wrap('Selo / Emoji',
        'Escolha até 3 emojis para decorar o canto do cartão, como um selo.',
        `<div class="emoji-grid" id="emojiGrid"></div>`);
    }

    if(current === 8){
      const m = state.music;
      html = wrap('Escolha uma música',
        'Cole o link de uma música do YouTube e escolha o trecho que vai tocar quando abrirem o cartão.',
        `
        <div class="field">
          <label class="field-label">Link do YouTube</label>
          <input type="text" id="inpYtUrl" placeholder="https://www.youtube.com/watch?v=..." value="${m ? escapeHtml(m.url) : ''}">
        </div>
        <div class="hint" id="ytHint">${m ? '' : 'Cole um link do YouTube para continuar.'}</div>

        <div id="ytPreviewBox"${m ? '' : ' hidden'}>
          <div class="mcard" id="trim">
            <div class="mcard-bg" id="mcardBg"></div>
            <div class="mcard-body">
            <div class="mcard-top">
              <img class="mcard-thumb" id="mcardThumb" alt="">
              <div class="mcard-meta">
                <div class="mcard-title" id="mcardTitle">Carregando música…</div>
                <div class="mcard-sub" id="mcardSub">Trecho que vai tocar</div>
              </div>
              <span class="trim-badge" id="trimDur">—</span>
            </div>

            <div class="trim-slider is-loading" id="trimSlider">
              <div class="trim-rail">
                <div class="trim-track"></div>
                <div class="trim-range" id="trimRange"></div>
                <div class="trim-playhead" id="trimPlayhead" hidden></div>
              </div>
              <input type="range" class="trim-input" id="trimStart" min="0" max="100" step="1" value="0" aria-label="Início do trecho" disabled>
              <input type="range" class="trim-input" id="trimEnd" min="0" max="100" step="1" value="30" aria-label="Fim do trecho" disabled>
            </div>
            <div class="trim-scale"><span>00:00</span><span id="trimTotal">carregando…</span></div>

            <div class="mcard-controls">
              <button class="mcard-play play-btn" id="btnYtTest" type="button" aria-label="Ouvir trecho" disabled><svg class="ico-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.1-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6Z"/></svg><svg class="ico-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.3"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.3"/></svg></button>
              <div class="trim-times">
                <div><span>Início</span><b id="trimStartLabel">00:00</b></div>
                <div><span>Fim</span><b id="trimEndLabel">00:00</b></div>
              </div>
            </div>
            </div>
          </div>
          <p class="hint" id="ytRangeHint">Arraste as bolinhas para escolher o início e o fim. Ao soltar, o trecho toca.</p>
        </div>

        <div class="no-music-row" id="noMusicOption">
          <div class="song-icon">✕</div>
          <div>
            <div class="no-music-title">Sem música</div>
            <div class="no-music-sub">O cartão fica só com a mensagem</div>
          </div>
        </div>
        `);
    }

    if(current === FINAL_INDEX){
      html = `
        <div class="step-eyebrow">Passo ${current+1} de ${STEPS.length}</div>
        <h2 class="step-title">Cartão pronto! 🌸</h2>
        <p class="step-desc">Envie o link por mensagem ou imprima o QR code para colar junto com o buquê.</p>

        <label class="field-label" for="finalLinkInput">Link do cartão</label>
        <div class="final-link-box">
          <input type="text" id="finalLinkInput" readonly value="Gerando link…">
          <button class="btn btn-primary" id="btnCopyLink" disabled>Copiar link</button>
        </div>
        <div class="hint ok" id="copyFeedback" role="status" hidden>Link copiado! ✅</div>

        <div class="final-actions">
          <a class="btn btn-ghost" id="btnOpenCard" target="_blank" rel="noopener" aria-disabled="true">👁️ Ver como quem recebe</a>
          <a class="btn btn-ghost" id="btnWhatsApp" target="_blank" rel="noopener" aria-disabled="true">💬 Enviar no WhatsApp</a>
        </div>

        <div class="qr-section">
          <div class="qr-box" id="qrBox"><img id="qrImg" alt="QR code do cartão"></div>
          <div class="qr-info">
            <p>Escaneie para abrir o cartão direto no celular — ideal para colar uma etiqueta no buquê.</p>
            <div class="qr-actions">
              <button class="btn btn-ghost" id="btnPrintQr" type="button" disabled>🖨️ Imprimir QR Code</button>
              <button class="btn btn-ghost" id="btnEditCard" type="button">✎ Editar cartão</button>
              <button class="btn btn-ghost" id="btnNewCard" type="button">＋ Criar outro cartão</button>
            </div>
          </div>
        </div>

        ${state.photos.length ? `
        <div class="hint warn">📷 Modo demonstração: as fotos ficam salvas só neste aparelho. Para que elas cheguem a quem recebe, o projeto precisa de um servidor (próxima etapa).</div>` : ''}
        <div class="hint warn" id="saveWarn" hidden>⚠️ O navegador não deixou salvar as fotos (espaço cheio). O link funciona normalmente, mas sem as fotos.</div>
      `;
    }

    c.innerHTML = html;
    bindStepEvents();
  }

  /* ---------------- BIND EVENTS PER STEP ---------------- */
  function bindStepEvents(){

    if(current === 0){
      const inp = document.getElementById('inpSlug');
      const count = document.getElementById('slugCount');
      const result = document.getElementById('slugResult');
      const update = () => {
        state.slugRaw = inp.value;
        state.slug = slugify(inp.value).slice(0,60).replace(/-+$/, '');
        count.textContent = `${state.slug.length}/60 caracteres`;
        result.innerHTML = state.slug
          ? `Endereço do cartão: <b>/${escapeHtml(state.slug)}</b>`
          : 'Acentos, espaços e símbolos são ajustados automaticamente.';
        clearStepError();
        renderPreview();
      };
      inp.addEventListener('input', update);
      update();
    }

    if(current === 1){
      const inp = document.getElementById('inpTitle');
      const count = document.getElementById('titleCount');
      const update = () => {
        state.title = inp.value.slice(0,80);
        count.textContent = `${state.title.length}/80 caracteres`;
        clearStepError();
        renderPreview();
      };
      inp.addEventListener('input', update);
      update();
    }

    if(current === 2){
      bindBuyerForm();
    }

    if(current === 3){
      const grid = document.getElementById('catGrid');
      grid.innerHTML = '';
      CATEGORIES.forEach(cat => {
        const chip = el('div', 'chip' + (state.category === cat.id ? ' selected':''), `<span>${cat.icon}</span><span>${cat.label}</span>`);
        chip.addEventListener('click', () => {
          state.category = state.category === cat.id ? '' : cat.id;
          bindStepEvents();
          renderPreview();
        });
        grid.appendChild(chip);
      });
    }

    if(current === 4){
      const sw = document.getElementById('dateSwitch');
      const field = document.getElementById('dateField');
      sw.addEventListener('click', () => {
        state.hasDate = !state.hasDate;
        sw.classList.toggle('on', state.hasDate);
        field.hidden = !state.hasDate;
        renderPreview();
      });
      const inpDate = document.getElementById('inpDate');
      if(inpDate){
        inpDate.addEventListener('input', () => { state.eventDate = inpDate.value; renderPreview(); });
      }
    }

    if(current === 5){
      const pills = document.querySelectorAll('.style-pill');
      pills.forEach(p => {
        p.classList.toggle('selected', p.dataset.style === state.msgStyle);
        p.addEventListener('click', () => {
          state.msgStyle = p.dataset.style;
          bindStepEvents();
          renderPreview();
        });
      });
      const ta = document.getElementById('inpMessage');
      const count = document.getElementById('msgCount');
      const update = () => {
        state.message = ta.value.slice(0,400);
        count.textContent = `${state.message.length}/400 caracteres`;
        renderPreview();
      };
      ta.addEventListener('input', update);
      update();
    }

    if(current === 6){
      const dz = document.getElementById('dropzone');
      const input = document.getElementById('fileInput');
      dz.addEventListener('click', () => input.click());
      dz.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); input.click(); }
      });
      dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragging'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('dragging'));
      dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('dragging');
        addPhotos(e.dataTransfer.files);
      });
      input.addEventListener('change', (e) => {
        addPhotos(e.target.files);
        input.value = '';
      });
      renderThumbs();
    }

    if(current === 7){
      const grid = document.getElementById('emojiGrid');
      grid.innerHTML = '';
      EMOJIS.forEach(em => {
        const btn = el('div','emoji-btn' + (state.emojis.includes(em) ? ' selected':''), em);
        btn.addEventListener('click', () => {
          if(state.emojis.includes(em)){
            state.emojis = state.emojis.filter(x => x !== em);
          } else if(state.emojis.length < 3){
            state.emojis.push(em);
          }
          bindStepEvents();
          renderPreview();
        });
        grid.appendChild(btn);
      });
    }

    if(current === 8){
      bindMusicStep();
    }

    if(current === FINAL_INDEX){
      bindFinalStep();
    }
  }

  /* ---------------- MUSIC STEP (YouTube) ---------------- */
  const TRIM_MIN = 5;    // trecho mínimo (s)
  const TRIM_MAX = 120;  // trecho máximo (s) — o cartão toca no máximo 2 minutos
  const DEFAULT_TRIM = 30;

  const ytThumb = (id, size) => `https://i.ytimg.com/vi/${id}/${size || 'hqdefault'}.jpg`;

  // Carrega a YouTube IFrame API uma única vez
  let ytApiPromise = null;
  function loadYouTubeApi(){
    if(window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if(!ytApiPromise){
      ytApiPromise = new Promise((resolve) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if(prev) prev(); resolve(window.YT); };
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      });
    }
    return ytApiPromise;
  }

  /*
   * Player de áudio único da página: um player do YouTube invisível (#ytAudioHost).
   * O passo de música e a prévia do cartão usam o mesmo player, que nunca é recriado —
   * por isso trocar de passo ou mexer na barra não recarrega nada.
   */
  const Music = (() => {
    let player = null;
    let readyPromise = null;
    let loadedId = null;
    let session = null;   // { from, to, onTick, onEnd }
    let raf = null;
    const durationWaiters = [];
    let errorHandler = null;

    function ensure(videoId){
      if(readyPromise) return readyPromise;
      readyPromise = loadYouTubeApi().then(YT => new Promise(resolve => {
        loadedId = videoId;
        player = new YT.Player('ytAudioHost', {
          width: 200, height: 200, videoId,
          playerVars: { rel: 0, playsinline: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3 },
          events: {
            onReady: () => { resolve(player); checkDuration(); },
            onStateChange: (e) => {
              checkDuration();
              // Pausado por fora (ex: fone desconectado): encerra a sessão
              if(e.data === YT.PlayerState.PAUSED && session && !session.seeking) end();
              if(e.data === YT.PlayerState.PLAYING && session) session.seeking = false;
            },
            onError: (e) => { end(); if(errorHandler) errorHandler(e.data); },
          },
        });
      }));
      return readyPromise;
    }

    function checkDuration(){
      const d = player && player.getDuration ? player.getDuration() : 0;
      if(d > 0) while(durationWaiters.length) durationWaiters.shift()(d);
    }

    // Prepara um vídeo e devolve a duração (s) quando o YouTube informar
    async function load(videoId){
      await ensure(videoId);
      if(loadedId !== videoId){
        stop();
        loadedId = videoId;
        player.cueVideoById({ videoId });
      }
      return new Promise(resolve => {
        durationWaiters.push(resolve);
        checkDuration();
      });
    }

    // Controle de parada por temporizador (funciona mesmo com a aba em segundo plano);
    // o marcador visual usa requestAnimationFrame, que acompanha a taxa da tela.
    let stopTimer = null;
    function checkEnd(){
      if(!session || session.seeking) return; // durante o seek o tempo ainda é o antigo
      if(player.getCurrentTime() >= session.to - 0.12) end();
    }
    function animate(){
      if(!session) return;
      if(session.onTick && !session.seeking) session.onTick(player.getCurrentTime());
      raf = requestAnimationFrame(animate);
    }

    function end(){
      cancelAnimationFrame(raf);
      clearInterval(stopTimer);
      const s = session;
      session = null;
      if(player && player.pauseVideo) player.pauseVideo();
      if(s && s.onEnd) s.onEnd();
    }

    async function play(videoId, from, to, handlers){
      if(session) end(); // síncrono: a sessão anterior encerra antes da nova começar
      await load(videoId);
      const s = session = { from, to, seeking: true, ...handlers };
      setTimeout(() => { if(session === s) s.seeking = false; }, 1000);
      player.seekTo(from, true);
      player.playVideo();
      cancelAnimationFrame(raf);
      clearInterval(stopTimer);
      raf = requestAnimationFrame(animate);
      stopTimer = setInterval(checkEnd, 100);
    }

    return {
      load,
      play,
      stop(){ if(session) end(); },
      isPlaying(){ return !!session; },
      setEnd(to){ if(session) session.to = to; },
      onError(fn){ errorHandler = fn; },
    };
  })();

  // Controle do passo de música; existe só enquanto o passo está na tela
  let musicUI = null;

  function bindMusicStep(){
    const $ = (id) => document.getElementById(id);
    const urlInput = $('inpYtUrl');
    const hint = $('ytHint');
    const previewBox = $('ytPreviewBox');
    const noMusicRow = $('noMusicOption');
    const slider = $('trimSlider');
    const startIn = $('trimStart');
    const endIn = $('trimEnd');
    const rangeEl = $('trimRange');
    const playhead = $('trimPlayhead');
    const playBtn = $('btnYtTest');

    let length = 0;          // duração do vídeo (s); 0 = ainda desconhecida
    let destroyed = false;
    let paintQueued = false;
    let replayTimer = null;

    noMusicRow.classList.toggle('selected', state.music === null && urlInput.value.trim() === '');

    /* ---------- capa e título ---------- */
    function updateMeta(){
      const m = state.music;
      if(!m) return;
      const thumb = ytThumb(m.videoId);
      if($('mcardThumb').getAttribute('src') !== thumb){
        $('mcardThumb').src = thumb;
        $('mcardBg').style.backgroundImage = `url("${thumb}")`;
      }
      $('mcardTitle').textContent = m.title || 'Música do YouTube';
      $('mcardSub').textContent = m.channel || 'Trecho que vai tocar';
    }

    /* ---------- barra de dois cursores ---------- */
    const pct = (sec) => length ? (sec / length) * 100 : 0;

    // Atualizações visuais agrupadas em um quadro de animação: arrastar fica liso
    function paint(){
      if(paintQueued) return;
      paintQueued = true;
      requestAnimationFrame(() => {
        paintQueued = false;
        const m = state.music;
        if(destroyed || !m || !length) return;
        const s = m.start, e = m.start + m.duration;
        rangeEl.style.left = pct(s) + '%';
        rangeEl.style.width = (pct(e) - pct(s)) + '%';
        startIn.setAttribute('aria-valuetext', secToMMSS(s));
        endIn.setAttribute('aria-valuetext', secToMMSS(e));
        $('trimStartLabel').textContent = secToMMSS(s);
        $('trimEndLabel').textContent = secToMMSS(e);
        $('trimDur').textContent = `${m.duration}s`;
        // Cursor de início por cima quando os dois se encontram no fim da barra
        startIn.style.zIndex = s > length - TRIM_MIN * 2 ? 5 : 3;
        renderPreview();
      });
    }

    // Aplica limites: mínimo/máximo do trecho e fim do vídeo. "moved" = cursor arrastado.
    function setRange(start, end, moved){
      start = Math.round(start); end = Math.round(end);
      start = Math.max(0, Math.min(start, length - TRIM_MIN));
      end = Math.max(TRIM_MIN, Math.min(end, length));
      if(end - start < TRIM_MIN){
        if(moved === 'start') end = Math.min(length, start + TRIM_MIN);
        else start = Math.max(0, end - TRIM_MIN);
      }
      if(end - start > TRIM_MAX){
        // Arrastar além de 2 min "puxa" o outro cursor junto
        if(moved === 'start') end = start + TRIM_MAX;
        else start = end - TRIM_MAX;
      }
      state.music.start = start;
      state.music.duration = end - start;
      // Só corrige o valor do cursor se o limite mudou algo (evita "pulos" durante o arraste)
      if(+startIn.value !== start) startIn.value = start;
      if(+endIn.value !== end) endIn.value = end;
      Music.setEnd(end);
      paint();
    }

    function setLength(len){
      len = Math.floor(len);
      if(destroyed || !len || length === len || !state.music) return;
      length = len;
      startIn.max = endIn.max = length;
      $('trimTotal').textContent = secToMMSS(length);
      slider.classList.remove('is-loading');
      if(hint.textContent === 'Carregando música…') hint.textContent = '';
      startIn.disabled = endIn.disabled = playBtn.disabled = false;
      const m = state.music;
      // Vídeo menor que o trecho salvo: reaproveita o que couber
      const dur = Math.min(m.duration || DEFAULT_TRIM, TRIM_MAX, length);
      const start = Math.min(m.start || 0, Math.max(0, length - dur));
      startIn.value = start;
      endIn.value = start + dur;
      setRange(start, start + dur, 'start');
    }

    startIn.addEventListener('input', () => setRange(+startIn.value, +endIn.value, 'start'));
    endIn.addEventListener('input', () => setRange(+startIn.value, +endIn.value, 'end'));

    // Ao soltar: início toca o trecho desde o começo; fim toca os últimos 3 segundos.
    // Pequena espera agrupa toques seguidos (ex: setas do teclado) numa reprodução só.
    function replaySoon(fromEnd){
      clearTimeout(replayTimer);
      replayTimer = setTimeout(() => {
        const m = state.music;
        const end = m.start + m.duration;
        playSnippet(fromEnd ? Math.max(m.start, end - 3) : m.start);
      }, 180);
    }
    startIn.addEventListener('change', () => replaySoon(false));
    endIn.addEventListener('change', () => replaySoon(true));

    /* ---------- reprodução ---------- */
    function setPlayingUI(on){
      playBtn.classList.toggle('is-playing', on);
      playBtn.setAttribute('aria-label', on ? 'Parar' : 'Ouvir trecho');
      playhead.hidden = !on;
      $('trim').classList.toggle('playing', on);
    }

    function playSnippet(from){
      const m = state.music;
      if(!m || !length) return;
      Music.play(m.videoId, from, m.start + m.duration, {
        onTick: (t) => { playhead.style.transform = `translateX(${pct(t) / 100 * rangeEl.parentElement.clientWidth}px)`; },
        onEnd: () => { if(!destroyed) setPlayingUI(false); },
      });
      setPlayingUI(true);
    }

    playBtn.addEventListener('click', () => {
      if(Music.isPlaying()) Music.stop();
      else playSnippet(state.music.start);
    });

    Music.onError((code) => {
      if(destroyed) return;
      hint.textContent = (code === 101 || code === 150)
        ? '⚠️ O dono desse vídeo não permite que ele toque fora do YouTube. Escolha outra versão da música.'
        : 'Esse vídeo não pode ser reproduzido — ele pode ser privado ou ter sido removido.';
      hint.className = 'hint warn';
    });

    /* ---------- link ---------- */
    function applyUrl(){
      const id = extractYouTubeId(urlInput.value.trim());
      if(!id){
        hint.textContent = 'Não encontramos um link válido do YouTube. Cole a URL completa.';
        hint.className = 'hint error';
        previewBox.hidden = true;
        return;
      }
      previewBox.hidden = false;
      const same = state.music && state.music.videoId === id;
      if(!same){
        Music.stop();
        hint.textContent = 'Carregando música…';
        hint.className = 'hint';
        length = 0;
        slider.classList.add('is-loading');
        startIn.disabled = endIn.disabled = playBtn.disabled = true;
        $('trimTotal').textContent = 'carregando…';
        state.music = { videoId: id, url: urlInput.value.trim(), start: 0, duration: DEFAULT_TRIM, title: null, channel: null, videoLength: null };
      } else {
        state.music.url = urlInput.value.trim();
        if(state.music.videoLength) setLength(state.music.videoLength);
      }
      updateMeta();
      Music.load(id).then(d => { if(state.music && state.music.videoId === id) setLength(d); });
      fetchTitle(id);
      renderPreview();
    }

    let debounceTimer = null;
    urlInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyUrl, 400);
      noMusicRow.classList.remove('selected');
    });

    noMusicRow.addEventListener('click', () => {
      Music.stop();
      state.music = null;
      urlInput.value = '';
      previewBox.hidden = true;
      hint.textContent = 'Cole um link do YouTube para continuar.';
      hint.className = 'hint';
      noMusicRow.classList.add('selected');
      renderPreview();
    });

    musicUI = {
      setLength,
      updateMeta,
      destroy(){
        destroyed = true;
        clearTimeout(replayTimer);
        Music.stop();
      },
    };

    if(state.music && state.music.videoId) applyUrl();
  }

  // Converte duração ISO 8601 da API (ex: PT3M42S) em segundos
  function isoDurationToSec(iso){
    const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
    if(!m) return null;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }

  function fetchTitle(videoId){
    if(!YT_API_KEY){ fetchTitleNoembed(videoId); return; }

    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${videoId}&key=${encodeURIComponent(YT_API_KEY)}`;
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        if(!state.music || state.music.videoId !== videoId) return;
        const hint = document.getElementById('ytHint');
        const video = data.items && data.items[0];

        if(!video){
          if(hint){
            hint.textContent = 'Esse vídeo não foi encontrado — ele pode ser privado ou ter sido removido.';
            hint.className = 'hint error';
          }
          return;
        }

        state.music.title = video.snippet.title;
        state.music.channel = video.snippet.channelTitle;
        state.music.videoLength = isoDurationToSec(video.contentDetails.duration);

        if(hint){
          if(video.status && video.status.embeddable === false){
            hint.textContent = '⚠️ O dono desse vídeo não permite que ele toque fora do YouTube. Escolha outra versão da música.';
            hint.className = 'hint warn';
          } else {
            hint.textContent = ''; // título e canal aparecem na capa da música
            hint.className = 'hint';
          }
        }
        if(musicUI) musicUI.updateMeta();

        // A API costuma responder antes do player: já libera a barra com a duração certa
        if(musicUI && state.music.videoLength) musicUI.setLength(state.music.videoLength);

        renderPreview();
      })
      .catch(() => fetchTitleNoembed(videoId)); // chave inválida / cota esgotada — tenta o caminho sem chave
  }

  function fetchTitleNoembed(videoId){
    fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if(data && data.title && state.music && state.music.videoId === videoId){
          state.music.title = data.title;
          state.music.channel = state.music.channel || data.author_name || null;
          if(musicUI) musicUI.updateMeta();
          renderPreview();
        }
      })
      .catch(() => { /* sem internet ou bloqueado — mantém rótulo genérico */ });
  }

  /* ---------------- FOTOS ---------------- */
  const MAX_PHOTOS = 4;
  const PHOTO_MAX_SIDE = 1000; // px — suficiente para o cartão e leve para salvar

  // Redimensiona e converte para JPEG: uma foto de celular (~4 MB) vira ~100 KB.
  function compressImage(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')); };
      img.src = url;
    });
  }

  async function addPhotos(fileList){
    const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'));
    const room = MAX_PHOTOS - state.photos.length;
    if(!files.length) return;
    if(room <= 0){ showStepError(`Você já adicionou ${MAX_PHOTOS} fotos. Remova uma para trocar.`); return; }
    if(files.length > room) showStepError(`Só cabem mais ${room} foto${room === 1 ? '' : 's'} — as demais foram ignoradas.`);
    else clearStepError();

    for(const f of files.slice(0, room)){
      try{
        state.photos.push(await compressImage(f));
      } catch(e){
        showStepError(`Não conseguimos abrir "${f.name}". Tente outra imagem.`);
      }
      renderThumbs();
      renderPreview();
    }
  }

  /* ---------------- ERROS INLINE ---------------- */
  function showStepError(msg){
    const box = document.getElementById('stepError');
    if(box){ box.textContent = msg; }
    else { alert(msg); }
  }
  function clearStepError(){
    const box = document.getElementById('stepError');
    if(box) box.textContent = '';
  }

  /* ---------------- RASCUNHO (não perde nada ao recarregar) ---------------- */
  let draftTimer = null;
  function saveDraft(){
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const data = { state, current };
      try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); }
      catch(e){
        // Fotos podem estourar a cota: salva o resto mesmo assim
        try{ localStorage.setItem(DRAFT_KEY, JSON.stringify({ state: { ...state, photos: [] }, current })); } catch(e2){}
      }
    }, 300);
  }

  function loadDraft(){
    try{
      const data = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if(!data || !data.state) return;
      Object.assign(state, data.state);
      current = Math.min(Math.max(0, data.current | 0), FINAL_INDEX);
      if(current > 0 && !state.slug) current = 0;
      if(current > 1 && !state.title) current = 1;
      if(current > 2 && !validateBuyer(false)) current = 2; // rascunho antigo, sem cadastro completo
    } catch(e){ /* rascunho corrompido: começa do zero */ }
  }

  function resetCard(){
    try{ localStorage.removeItem(DRAFT_KEY); } catch(e){}
    Object.assign(state, {
      id: newCardId(), slugRaw: '', slug: '', title: '', senderName: '', buyerEmail: '', buyerPhone: '',
      category: '', hasDate: false, eventDate: '', message: '', msgStyle: 'sans',
      photos: [], emojis: [], music: null,
    });
    current = 0;
    Music.stop();
    render();
    renderPreview();
  }

  function renderThumbs(){
    const t = document.getElementById('thumbs');
    if(!t) return;
    t.innerHTML = '';
    state.photos.forEach((src, i) => {
      const th = el('div','thumb');
      th.innerHTML = `<img src="${src}" alt="Foto ${i+1}"><button type="button" aria-label="Remover foto ${i+1}">✕</button>`;
      th.querySelector('button').addEventListener('click', () => {
        state.photos.splice(i,1);
        renderThumbs();
        renderPreview();
      });
      t.appendChild(th);
    });
  }

  /* ---------------- FINAL STEP (link + qr) ---------------- */
  // Dados que vão no link — sem o contato (privado) e sem as fotos (pesadas demais para um link).
  function buildCardPayload(){
    const m = state.music;
    return {
      v: window.Cartao.CARD_VERSION,
      id: state.id,
      slug: state.slug,
      title: state.title.trim(),
      from: state.senderName.trim(),
      category: state.category,
      date: state.hasDate && state.eventDate ? state.eventDate : null,
      message: state.message,
      style: state.msgStyle,
      emojis: state.emojis,
      photoCount: state.photos.length,
      music: m && m.videoId ? { id: m.videoId, start: m.start, dur: m.duration, title: m.title || null, channel: m.channel || null } : null,
    };
  }

  // QR gerado no próprio navegador: o conteúdo do cartão não passa por nenhum serviço externo.
  function makeQrDataUrl(text){
    if(typeof window.qrcode !== 'function') return null;
    const qr = window.qrcode(0, 'L');
    qr.addData(text, 'Byte');
    qr.make();
    const cell = Math.max(2, Math.floor(480 / qr.getModuleCount()));
    return qr.createDataURL(cell, cell * 2);
  }

  async function bindFinalStep(){
    const linkInput = document.getElementById('finalLinkInput');
    const copyBtn = document.getElementById('btnCopyLink');
    const feedback = document.getElementById('copyFeedback');
    const qrImg = document.getElementById('qrImg');
    const qrBox = document.getElementById('qrBox');
    const printBtn = document.getElementById('btnPrintQr');
    const openBtn = document.getElementById('btnOpenCard');
    const waBtn = document.getElementById('btnWhatsApp');

    document.getElementById('btnEditCard').addEventListener('click', () => { current = 0; render(); });
    document.getElementById('btnNewCard').addEventListener('click', () => {
      if(confirm('Começar um cartão novo? O cartão atual continua funcionando pelo link já gerado.')) resetCard();
    });

    const card = buildCardPayload();
    const saved = CardStore.save(card, state.photos);
    if(!saved && state.photos.length) document.getElementById('saveWarn').hidden = false;

    const url = await buildCardUrl(card);
    if(current !== FINAL_INDEX) return; // usuário saiu do passo enquanto o link era gerado

    linkInput.value = url;
    copyBtn.disabled = false;
    printBtn.disabled = false;
    openBtn.href = url;
    openBtn.removeAttribute('aria-disabled');
    const waText = `${state.title ? state.title + ' — ' : ''}Você recebeu um cartão com flores 🌸 ${url}`;
    waBtn.href = `https://wa.me/?text=${encodeURIComponent(waText)}`;
    waBtn.removeAttribute('aria-disabled');

    const qrSrc = makeQrDataUrl(url);
    if(qrSrc){
      qrImg.src = qrSrc;
    } else {
      qrBox.innerHTML = '<span class="hint">QR code indisponível sem internet.</span>';
      printBtn.disabled = true;
    }

    const showCopied = () => {
      feedback.hidden = false;
      setTimeout(() => feedback.hidden = true, 2500);
    };
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(url).then(showCopied).catch(() => {
        linkInput.select();
        document.execCommand('copy');
        showCopied();
      });
    });

    printBtn.addEventListener('click', () => {
      document.getElementById('printQrImg').src = qrImg.src;
      document.getElementById('printCardTitle').textContent = state.title || 'Cartão com Flores';
      document.getElementById('printCardUrl').textContent = 'Aponte a câmera do celular para abrir o cartão';
      document.body.classList.add('printing-qr');
      window.print();
    });
  }

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-qr');
  });

  /* ---------------- PREVIEW ---------------- */
  // Atualiza um elemento só quando o valor muda: evita recarregar imagens a cada tecla/arraste
  function setIfChanged(el, prop, value){
    if(el[prop] !== value) el[prop] = value;
  }

  let lastPhotoSrc = null;
  let lastThumbId = null;

  function renderPreview(){
    const $ = (id) => document.getElementById(id);
    const catObj = CATEGORIES.find(c => c.id === state.category);
    setIfChanged($('pvCat'), 'innerHTML', catObj ? `<span>${catObj.icon}</span> ${catObj.label}` : 'Sem categoria');
    setIfChanged($('pvTitle'), 'textContent', state.title || 'Título do seu cartão');
    setIfChanged($('pvSlug'), 'textContent', '/' + (state.slug || '...'));
    setIfChanged($('urlPreviewInline'), 'textContent', 'cartao/' + (state.slug || '...'));
    setIfChanged($('pvFullUrl'), 'textContent', 'cartao/' + (state.slug || 'seu-link-aqui'));

    const photoSrc = state.photos[0] || null;
    if(photoSrc !== lastPhotoSrc){
      lastPhotoSrc = photoSrc;
      $('pvPhoto').innerHTML = photoSrc
        ? `<img src="${photoSrc}" alt="">`
        : `<span class="empty-ph">Suas fotos aparecem aqui</span>`;
    }

    const dateBox = $('pvDate');
    const counter = state.hasDate ? formatDateCounter(state.eventDate) : '';
    dateBox.hidden = !counter;
    setIfChanged(dateBox, 'textContent', counter ? `🗓️ ${counter}` : '');

    const msg = $('pvMsg');
    setIfChanged(msg, 'textContent', state.message || 'Sua mensagem vai aparecer aqui conforme você escreve…');
    setIfChanged(msg, 'className', 'card-msg' + (state.msgStyle === 'serif' ? ' style-serif' : state.msgStyle === 'script' ? ' style-script' : ''));

    setIfChanged($('pvFrom'), 'innerHTML', `Com carinho, <b>${escapeHtml(state.senderName.trim() || 'seu nome')}</b>`);
    setIfChanged($('pvEmojis'), 'textContent', state.emojis.join(' '));

    const m = state.music;
    if(m && m.videoId){
      $('pvPlayer').hidden = false;
      if(lastThumbId !== m.videoId){
        lastThumbId = m.videoId;
        $('pvThumb').innerHTML = `<img src="${ytThumb(m.videoId, 'default')}" alt="">`;
      }
      setIfChanged($('pvSongTitle'), 'textContent', m.title || 'Trecho selecionado do YouTube');
      setIfChanged($('pvSongSub'), 'textContent', (m.channel ? m.channel + ' · ' : '') + `${secToMMSS(m.start)} · ${m.duration}s`);
    } else {
      $('pvPlayer').hidden = true;
      if(pvPlaying) Music.stop();
    }

    renderSprig();
    saveDraft();
  }

  // ▶ da prévia toca o trecho pelo mesmo player invisível do passo de música
  let pvPlaying = false;
  function setPreviewPlayingUI(on){
    pvPlaying = on;
    document.getElementById('pvPlayBtn').classList.toggle('is-playing', on);
    document.getElementById('pvPlayBtn').setAttribute('aria-label', on ? 'Parar trecho' : 'Tocar trecho');
    document.getElementById('pvEq').classList.toggle('paused', !on);
  }
  document.getElementById('pvPlayBtn').addEventListener('click', () => {
    const m = state.music;
    if(pvPlaying || !m){ Music.stop(); return; }
    Music.play(m.videoId, m.start, m.start + m.duration, { onEnd: () => setPreviewPlayingUI(false) });
    setPreviewPlayingUI(true);
  });

  /* ---------------- NAV ---------------- */
  function render(){
    renderTracker();
    renderStepContent();
    renderSprig();

    const navRow = document.getElementById('navRow');
    const linkLine = document.getElementById('linkLineWrap');

    if(current === FINAL_INDEX){
      navRow.hidden = true;
      linkLine.hidden = true;
    } else {
      navRow.hidden = false;
      linkLine.hidden = false;
      document.getElementById('btnPrev').disabled = current === 0;
      document.getElementById('btnNext').textContent = current === STEPS.length - 2 ? 'Finalizar' : 'Próximo';
    }
  }

  document.getElementById('btnPrev').addEventListener('click', () => {
    if(current > 0){ current--; render(); }
  });

  /* ---------------- CADASTRO DO COMPRADOR (passo 3) ---------------- */
  const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

  // (11) 91234-5678 para celular, (11) 3123-4567 para fixo — formata enquanto digita
  function formatPhone(value){
    const d = onlyDigits(value).slice(0, 11);
    if(d.length <= 2) return d.length ? `(${d}` : '';
    const ddd = d.slice(0, 2), rest = d.slice(2);
    if(rest.length <= 4) return `(${ddd}) ${rest}`;
    const split = d.length === 11 ? 5 : 4;
    return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
  }

  // Cada regra devolve a mensagem de erro, ou '' se o valor estiver certo
  const BUYER_FIELDS = {
    name: {
      input: 'inpBuyerName', error: 'errBuyerName', key: 'senderName',
      check(v){
        const t = v.trim().replace(/\s+/g, ' ');
        if(!t) return 'Informe seu nome completo.';
        if(t.split(' ').length < 2 || t.length < 5) return 'Informe nome e sobrenome.';
        if(/\d/.test(t)) return 'O nome não pode ter números.';
        return '';
      },
    },
    email: {
      input: 'inpBuyerEmail', error: 'errBuyerEmail', key: 'buyerEmail',
      check(v){
        const t = v.trim();
        if(!t) return 'Informe seu e-mail.';
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) return 'Confira o e-mail — ex: voce@email.com';
        return '';
      },
    },
    phone: {
      input: 'inpBuyerPhone', error: 'errBuyerPhone', key: 'buyerPhone',
      check(v){
        const d = onlyDigits(v);
        if(!d) return 'Informe seu telefone com DDD.';
        if(d.length < 10) return 'Telefone incompleto — inclua o DDD.';
        if(d[0] === '0' || d[1] === '0') return 'DDD inválido.';
        if(d.length === 11 && d[2] !== '9') return 'Celular deve começar com 9 depois do DDD.';
        return '';
      },
    },
  };

  function showFieldError(field, msg){
    const input = document.getElementById(field.input);
    const box = document.getElementById(field.error);
    if(!input || !box) return;
    box.textContent = msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  // Valida tudo; com "show" mostra os erros e foca o primeiro campo errado
  function validateBuyer(show){
    let firstBad = null;
    for(const field of Object.values(BUYER_FIELDS)){
      const msg = field.check(state[field.key] || '');
      if(show) showFieldError(field, msg);
      if(msg && !firstBad) firstBad = field;
    }
    if(show && firstBad) document.getElementById(firstBad.input).focus();
    return !firstBad;
  }

  function bindBuyerForm(){
    for(const field of Object.values(BUYER_FIELDS)){
      const input = document.getElementById(field.input);
      let touched = !!state[field.key];

      input.addEventListener('input', () => {
        if(field.key === 'buyerPhone'){
          // Mantém o cursor no lugar certo depois da máscara
          const digitsBefore = onlyDigits(input.value.slice(0, input.selectionStart)).length;
          input.value = formatPhone(input.value);
          let pos = 0, seen = 0;
          while(pos < input.value.length && seen < digitsBefore){ if(/\d/.test(input.value[pos])) seen++; pos++; }
          input.setSelectionRange(pos, pos);
        }
        state[field.key] = input.value;
        // Depois do primeiro erro, o aviso some assim que o valor fica certo
        if(input.getAttribute('aria-invalid') === 'true') showFieldError(field, field.check(input.value));
        if(field.key === 'senderName') renderPreview();
        else saveDraft();
      });

      // Mostra o erro ao sair do campo, só se a pessoa já digitou algo nele
      input.addEventListener('blur', () => {
        if(input.value.trim()) touched = true;
        if(touched) showFieldError(field, field.check(input.value));
      });
    }

    // Enter no formulário avança, como o botão "Próximo"
    document.getElementById('buyerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      document.getElementById('btnNext').click();
    });
  }

  function validateStep(){
    if(current === 0 && state.slug.length < 3) return 'Escolha um nome com pelo menos 3 letras ou números.';
    if(current === 1 && !state.title.trim()) return 'Dê um título ao seu cartão antes de continuar.';
    return null;
  }

  document.getElementById('btnNext').addEventListener('click', () => {
    if(current === 2 && !validateBuyer(true)) return; // erros aparecem em cada campo
    const error = validateStep();
    if(error){
      showStepError(error);
      const field = document.querySelector('#step-content input');
      if(field) field.focus();
      return;
    }
    if(current < STEPS.length - 1){
      current++;
      render();
      // No celular o assistente fica em cima da prévia: volta ao topo do passo
      document.querySelector('.wizard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  loadDraft();
  render();
  renderPreview();

})();
