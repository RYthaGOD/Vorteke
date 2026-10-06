import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vortexsol.app';

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'always',
            priority: 1,
        },
        ...['/terminal', '/launches'].map(path => ({ url: baseUrl + path, lastModified: new Date(), changeFrequency: 'always' as const, priority: 0.9 })),
        { url: `${baseUrl}/elite`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
        ...['/terms', '/privacy', '/risk'].map(path => ({ url: baseUrl + path, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.3 })),
    ];
}
