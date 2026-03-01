import { useCallback, useState } from 'react';
import * as htmlToImage from 'html-to-image';

export const useCaptureReport = (elementId: string, tokenSymbol: string) => {
    const [isCapturing, setIsCapturing] = useState(false);

    const captureReport = useCallback(async () => {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error('VORTEX_RECON_FAILURE: Capture target not found.');
            return;
        }

        try {
            setIsCapturing(true);

            // Add a small delay for industrial glitch effects to "settle" or for the HUD to look its best
            await new Promise(resolve => setTimeout(resolve, 500));

            // Implementation of the "Industrial Signature" frame
            const dataUrl = await htmlToImage.toPng(element, {
                pixelRatio: 2, // High DPI for crisp tactical reports
                filter: (node: HTMLElement) => {
                    // Hide elements that shouldn't be in the report (e.g., buttons, navigation)
                    if (node?.classList?.contains('vortex-no-capture')) {
                        return false;
                    }
                    return true;
                },
                backgroundColor: '#0a0b0d' // Dark industrial background
            });

            // Create download link
            const link = document.createElement('a');
            link.download = `VORTEX_RECON_${tokenSymbol}_${Date.now()}.png`;
            link.href = dataUrl;
            link.click();

        } catch (error) {
            console.error('VORTEX_RECON_CRITICAL_FAILURE:', error);
        } finally {
            setIsCapturing(false);
        }
    }, [elementId, tokenSymbol]);

    return { captureReport, isCapturing };
};
