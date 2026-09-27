export const formatCurrency = (val: number, minimumDecimals: number = 2) => {
    if (val === 0) return '$0.00';

    // Industrial-grade dynamic decimal resolution for memecoins
    let decimals = minimumDecimals;
    if (val < 1) {
        const str = val.toFixed(20);
        const match = str.match(/0\.0*[1-9]/);
        if (match) {
            const leadingZeros = match[0].length - 3; // count zeros after decimal point
            decimals = Math.max(minimumDecimals, leadingZeros + 4);
        } else {
            decimals = Math.max(minimumDecimals, 4);
        }
    }

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: Math.min(20, decimals),
        maximumFractionDigits: Math.min(20, decimals)
    }).format(val);
};

export const formatCompact = (val: number) =>
    new Intl.NumberFormat('en-US', {
        notation: "compact",
        maximumFractionDigits: 1
    }).format(val);

export const formatPercent = (val: number) =>
    `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
