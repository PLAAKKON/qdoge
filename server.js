const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const rootDir = __dirname;
const port = Number(process.env.PORT) || 3000;
const tokenAddress = 'E2AQyiZKYftVRvR4g8VMMBpfD86PiGicWWARKuJdpump';
const dexUrls = [
  `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
  `https://api.dexscreener.com/latest/dex/search/?q=${tokenAddress}`
];

let marketStatsCache = {
  expiresAt: 0,
  payload: null
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jfif': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp'
};

function sendResponse(response, statusCode, headers, body) {
  response.writeHead(statusCode, headers);
  response.end(body);
}

function sendJson(response, statusCode, payload) {
  sendResponse(
    response,
    statusCode,
    {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    JSON.stringify(payload)
  );
}

async function fetchMarketStats() {
  if (marketStatsCache.payload && marketStatsCache.expiresAt > Date.now()) {
    return marketStatsCache.payload;
  }

  for (const url of dexUrls) {
    try {
      const apiResponse = await fetch(url, {
        headers: {
          accept: 'application/json'
        }
      });

      if (!apiResponse.ok) {
        continue;
      }

      const data = await apiResponse.json();
      const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
      const selectedPair = pairs
        .filter((pair) => pair?.chainId === 'solana')
        .sort((left, right) => Number(right?.liquidity?.usd || 0) - Number(left?.liquidity?.usd || 0))[0];

      if (!selectedPair) {
        continue;
      }

      const payload = {
        priceUsd: selectedPair.priceUsd,
        priceChangeH24: selectedPair?.priceChange?.h24,
        marketCap: selectedPair.marketCap,
        pairAddress: selectedPair.pairAddress,
        dexUrl: selectedPair.url
      };

      marketStatsCache = {
        payload,
        expiresAt: Date.now() + 15000
      };

      return payload;
    } catch (error) {
      console.error('Failed to fetch DexScreener data from', url, error);
    }
  }

  throw new Error('Unable to fetch market stats');
}

function safeResolve(requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split('?')[0]);
  const normalizedPath = path.normalize(decodedPath).replace(/^([.][.][\\/])+/, '');
  return path.join(rootDir, normalizedPath);
}

const server = http.createServer(async (request, response) => {
  if (request.url === '/api/market-stats') {
    try {
      const payload = await fetchMarketStats();
      sendJson(response, 200, payload);
    } catch (error) {
      sendJson(response, 502, { error: 'market_stats_unavailable' });
    }
    return;
  }

  const requestPath = request.url === '/' ? '/index.html' : request.url;
  const filePath = safeResolve(requestPath);

  if (!filePath.startsWith(rootDir)) {
    sendResponse(response, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError) {
      sendResponse(response, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
      return;
    }

    const resolvedPath = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;

    fs.readFile(resolvedPath, (readError, content) => {
      if (readError) {
        sendResponse(response, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
        return;
      }

      const extension = path.extname(resolvedPath).toLowerCase();
      const contentType = mimeTypes[extension] || 'application/octet-stream';

      sendResponse(response, 200, { 'Content-Type': contentType }, content);
    });
  });
});

server.listen(port, () => {
  console.log(`QDOGE server listening on port ${port}`);
});