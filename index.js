require('dotenv').config();
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

// 1. Definições do Addon
const manifest = {
    id: "com.legendas.ptbr.multisource",
    version: "1.0.0",
    name: "Legendas PT-BR Multi-Fontes",
    description: "Busca legendas em Português do Brasil de múltiplas fontes abertas e gratuitas.",
    resources: ["subtitles"],
    types: ["movie", "series"],
    idPrefixes: ["tt"], // tt é o prefixo de IDs do IMDb
    catalogs: []
};

const builder = new addonBuilder(manifest);

// 2. Lógica Principal: Receber o pedido do Stremio e buscar nas fontes
builder.defineSubtitlesHandler(async ({ type, id }) => {
    console.log(`[REQUEST] Buscando legendas para: Tipo=${type}, ID=${id}`);
    
    // O id no stremio para filmes vem como "tt1234567"
    // Para séries vem como "tt1234567:temporada:episodio" (ex: tt1234567:1:2)
    const idParts = id.split(':');
    const imdbId = idParts[0];
    const season = idParts[1] ? parseInt(idParts[1]) : undefined;
    const episode = idParts[2] ? parseInt(idParts[2]) : undefined;

    let allSubtitles = [];

    // --- FONTE 1: OpenSubtitles (API Pública/Guest) ---
    // Mesmo sem conta premium, o OpenSubtitles permite algumas buscas.
    try {
        console.log(`[BUSCA] Procurando no OpenSubtitles.org...`);
        const openSubtitlesResults = await fetchFromOpenSubtitles(imdbId, season, episode);
        allSubtitles = allSubtitles.concat(openSubtitlesResults);
    } catch (error) {
        console.error("[ERRO] Falha ao buscar no OpenSubtitles:", error.message);
    }

    // --- FONTE 2: Outros Sites Brasileiros (Scraping) ---
    // Aqui podemos adicionar módulos para Legendas.tv, Pipoca, etc.
    try {
        console.log(`[BUSCA] Procurando em fontes alternativas (Scraping)...`);
        // const scrapingResults = await fetchFromCustomScrapers(imdbId);
        // allSubtitles = allSubtitles.concat(scrapingResults);
    } catch (error) {
        console.error("[ERRO] Falha nos scrapers:", error.message);
    }

    // Retorna a lista final de legendas para o Stremio
    return { subtitles: allSubtitles };
});

// --- FUNÇÕES DE BUSCA (MÓDULOS) ---

// Função auxiliar para buscar no OpenSubtitles
async function fetchFromOpenSubtitles(imdbId, season, episode) {
    const subtitles = [];
    
    // API v1 do REST OpenSubtitles
    // Precisamos do ID do IMDB sem o 'tt'
    const cleanImdbId = imdbId.replace('tt', '');
    
    let apiUrl = `https://rest.opensubtitles.org/search/imdbid-${cleanImdbId}/sublanguageid-pob`;
    
    if (season && episode) {
        apiUrl = `https://rest.opensubtitles.org/search/episode-${episode}/imdbid-${cleanImdbId}/season-${season}/sublanguageid-pob`;
    }

    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'TemporaryUserAgent' // Em produção idealmente criamos um no site deles
            },
            timeout: 5000 // Para não travar o Stremio se o site cair
        });

        if (Array.isArray(response.data)) {
            response.data.forEach(sub => {
                subtitles.push({
                    id: sub.IDSubtitleFile,
                    url: sub.SubDownloadLink, // URL de download
                    lang: "por", // por = Português no padrão Stremio
                    name: "OpenSubtitles - " + sub.SubFileName // Nome que aparece na TV
                });
            });
        }
    } catch (e) {
        console.log("Erro OpenSubtitles REST:", e.message);
    }

    return subtitles;
}

// 3. Iniciando o servidor
const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
console.log(`[SUCESSO] Addon rodando em http://127.0.0.1:${port}`);
console.log(`[DICA] No Stremio, cole o link: http://127.0.0.1:${port}/manifest.json na barra de busca de Addons.`);
