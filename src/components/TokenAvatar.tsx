'use client';
import Image from 'next/image';
import { useState } from 'react';

export function TokenAvatar({ symbol = '', src }: { symbol?: string; src?: string | null }) {
    const [failed, setFailed] = useState<string | null>(null);
    // Remote https images, or logos shipped with the app for granted profiles.
    const safe = src && /^(https:\/\/|\/images\/tokens\/)/i.test(src) && failed !== src;
    return <span className="vortex-token-avatar" aria-hidden="true">
        {safe ? <Image src={src} alt="" width={36} height={36} unoptimized onError={() => setFailed(src)} /> : symbol.slice(0, 2).toUpperCase() || '?'}
    </span>;
}
