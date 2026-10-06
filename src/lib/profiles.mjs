// Shared rules for project profiles. Pure functions so the API routes and tests agree.

// 'Elite' is the pre-October 2026 name of the paid profile tier and still counts as paid.
const PAID_TIERS = ['Enhanced', 'Elite'];

export const BOOST_HOURS = 24;

/** Only a paid profile may set its own banner, logo, links and description. */
export function canEditProfile(tier) {
    return PAID_TIERS.includes(tier);
}

export function isBoostActive(profile, now = new Date()) {
    return !!profile?.boostExpiresAt && new Date(profile.boostExpiresAt).getTime() > now.getTime();
}

/** A new expiry `ms` after the later of now and the current expiry, so renewals stack. */
export function extendExpiry(current, ms, now = new Date()) {
    const start = Math.max(now.getTime(), current ? new Date(current).getTime() : 0);
    return new Date(start + ms);
}

function parseSocials(raw) {
    if (!raw) return {};
    try {
        const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const pick = key => typeof value?.[key] === 'string' && value[key].startsWith('https://') ? value[key] : undefined;
        return { twitter: pick('twitter'), telegram: pick('telegram'), website: pick('website') };
    } catch {
        return {};
    }
}

/**
 * What the public may see of a stored profile. Project-supplied identity (images, links,
 * description) shows only on a paid profile, so an unpaid claim can't decorate a token page.
 */
export function publicProfile(profile, now = new Date()) {
    if (!profile) return null;
    const paid = canEditProfile(profile.tier);
    return {
        address: profile.address,
        tier: paid ? 'Enhanced' : 'Basic',
        owner: profile.owner ?? null,
        boosted: isBoostActive(profile, now),
        boostExpiresAt: profile.boostExpiresAt ?? null,
        socials: paid ? parseSocials(profile.socials) : {},
        customDescription: paid ? profile.customDescription ?? null : null,
        bannerURI: paid ? profile.bannerURI ?? null : null,
        iconURI: paid ? profile.iconURI ?? null : null,
    };
}
