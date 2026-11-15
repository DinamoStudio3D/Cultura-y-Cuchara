import { readFileSync, writeFileSync } from 'node:fs';

// Social crawlers read HTML without JavaScript. Preview assets must use their deployment origin.
if (process.env.VERCEL_ENV === 'preview') {
    const hostname = process.env.VERCEL_URL;
    if (!hostname || !/^[a-z0-9.-]+\.vercel\.app$/i.test(hostname)) {
        throw new Error('Missing or invalid Preview deployment hostname');
    }
    const origin = `https://${hostname}`;
    const html = readFileSync('index.html', 'utf8');
    const updated = html.replace(
        /(<meta\s+(?:property|name)="(?:og:image|og:image:secure_url|twitter:image|og:url)"\s+content=")https:\/\/www\.visitaloja\.com(?=\/)/g,
        `$1${origin}`
    );
    writeFileSync('index.html', updated);
}
