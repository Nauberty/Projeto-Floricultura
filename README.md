# Projeto-Floricultura

Cartão virtual com flores da **Floricultura Alameda**: o cliente monta o cartão em um assistente passo a passo e recebe um link (e um QR code para colar no buquê). Quem recebe abre o link no celular e vê o cartão com mensagem, fotos, contador de data e música.

## Como rodar

Precisa do [Node.js](https://nodejs.org) (qualquer versão recente). Não há dependências para instalar.

```bash
npm start
```

- Neste computador: http://localhost:5173
- No celular, na mesma rede Wi-Fi: o endereço `http://192.168.x.x:5173` que aparece no terminal (crie o cartão por esse endereço para o QR code funcionar no celular).

### Configuração (opcional)

Copie `config.example.js` para `config.js` e preencha:

| Campo | Para quê |
|---|---|
| `YOUTUBE_API_KEY` | Chave da YouTube Data API v3: mostra título, canal e duração da música e avisa quando o vídeo não pode tocar fora do YouTube. Sem ela, o título vem do noembed.com. |
| `PUBLIC_BASE_URL` | Endereço do site publicado, usado nos links e no QR code. Vazio = endereço atual. |

O `config.js` está no `.gitignore` — a chave nunca vai para o GitHub. Restrinja a chave no Google Cloud Console (referenciadores HTTP + somente YouTube Data API v3).

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html` | Assistente de criação (10 passos) com pré-visualização em tempo real |
| `cartao.html` | Página que quem recebe abre: envelope → cartão, galeria de fotos, música |
| `js/cartao-shared.js` | Código comum: link do cartão, categorias, contador de datas, armazenamento |
| `scripts/servidor.js` | Servidor local sem dependências (`npm start`) |

## Como o link funciona (sem servidor)

Os dados de texto do cartão vão **compactados dentro do próprio link**, depois do `#`. O trecho depois do `#` nunca é enviado a servidor nenhum, então o link abre em qualquer aparelho e o conteúdo fica privado. O contato do remetente **não** vai no link.

**Limitação atual:** as fotos são grandes demais para um link e ficam salvas só no aparelho onde o cartão foi criado (`localStorage`). Para que cheguem a quem recebe, o próximo passo é trocar o `CardStore` de `js/cartao-shared.js` por um backend (Supabase, Firebase etc.), o que também permite links curtos como `/cartao/joana-e-marcos`.

## Recursos

- Rascunho salvo automaticamente — recarregar a página não perde nada
- Fotos comprimidas no navegador (foto de celular de ~4 MB vira ~100 KB), com arrastar e soltar
- Música do YouTube com escolha de trecho, que repete enquanto o cartão está aberto
- Contador de data: "3 anos e 4 meses desde…" ou "Faltam 12 dias para…"
- QR code gerado no próprio navegador (o conteúdo não passa por serviço externo)
- Enviar por WhatsApp, copiar link, imprimir QR
- Validação dentro da tela, textos do usuário sempre escapados (sem injeção de HTML)
