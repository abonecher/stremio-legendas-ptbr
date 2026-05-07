require('dotenv').config();
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');

const manifest = {
    id: "com.legendas.ptbr.multisource",
    version: "1.0.1",
    name: "Legendas PT-BR (Foco Animes & Filmes)",
    description: "Busca legendas em Português do Brasil para Animes e Filmes.",
    resources: ["subtitles"],
    types: ["movie", "series", "anime"],
    idPrefixes: ["tt", "kitsu"],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(async ({ type, id }) => {
    console.log(`[REQUEST] Buscando legendas para: Tipo=${type}, ID=${id}`);
    
    let allSubtitles = [];
    const idParts = id.split(':');

    // ==========================================
    // LÓGICA PARA ANIMES (KITSU)
    // ==========================================
    if (id.startsWith('kitsu:')) {
        const kitsuId = idParts[1];
        const episode = idParts[2] ? parseInt(idParts[2]) : undefined;
        
        console.log(`[BUSCA ANIME] Kitsu ID: ${kitsuId}, Episódio: ${episode}`);
        
        try {
            // 1. Descobrir o nome do anime na API oficial do Kitsu
            const kitsuRes = await axios.get(`https://kitsu.io/api/edge/anime/${kitsuId}`);
            const animeName = kitsuRes.data.data.attributes.canonicalTitle || kitsuRes.data.data.attributes.titles.en_jp;
            console.log(`[ANIME NOME ENCONTRADO] ${animeName}`);
            
            // 2. Buscar pelo nome no OpenSubtitles
            let queryUrl = `https://rest.opensubtitles.org/search/query-${encodeURIComponent(animeName)}/sublanguageid-pob`;
            if (episode) {
                // Se tiver episódio, incluímos na busca para ser mais preciso
                queryUrl = `https://rest.opensubtitles.org/search/episode-${episode}/query-${encodeURIComponent(animeName)}/sublanguageid-pob`;
            }
            
            const openSubRes = await axios.get(queryUrl, {
                headers: { 'User-Agent': 'TemporaryUserAgent' },
                timeout: 7000
            });
            
            if (Array.isArray(openSubRes.data)) {
                openSubRes.data.forEach(sub => {
                    allSubtitles.push({
                        id: String(sub.IDSubtitleFile),
                        url: sub.SubDownloadLink,
                        lang: "por",
                        name: "PT-BR Anime - " + sub.SubFileName
                    });
                });
            }
        } catch (e) {
            console.error("[ERRO ANIME]", e.message);
        }
    } 
    // ==========================================
    // LÓGICA PARA FILMES/SÉRIES COMUNS (IMDB)
    // ==========================================
    else if (id.startsWith('tt')) {
        const imdbId = idParts[0];
        const season = idParts[1] ? parseInt(idParts[1]) : undefined;
        const episode = idParts[2] ? parseInt(idParts[2]) : undefined;
        const cleanImdbId = imdbId.replace('tt', '');
        
        let apiUrl = `https://rest.opensubtitles.org/search/imdbid-${cleanImdbId}/sublanguageid-pob`;
        if (season && episode) {
            apiUrl = `https://rest.opensubtitles.org/search/episode-${episode}/imdbid-${cleanImdbId}/season-${season}/sublanguageid-pob`;
        }

        try {
            const response = await axios.get(apiUrl, {
                headers: { 'User-Agent': 'TemporaryUserAgent' },
                timeout: 5000
            });

            if (Array.isArray(response.data)) {
                response.data.forEach(sub => {
                    allSubtitles.push({
                        id: String(sub.IDSubtitleFile),
                        url: sub.SubDownloadLink,
                        lang: "por",
                        name: "PT-BR - " + sub.SubFileName
                    });
                });
            }
        } catch (e) {
            console.log("Erro OpenSubtitles REST:", e.message);
        }
    }

    return { subtitles: allSubtitles };
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
console.log(`[SUCESSO] Addon rodando na porta ${port}`);
