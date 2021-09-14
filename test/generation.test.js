const FingerprintGenerator = require('../src/main');

describe('Generation tests', () => {
    const fingerprintGenerator = new FingerprintGenerator();

    test('Generates fingerprints without errors', () => {
        for(let x = 0; x < 10000; x++) {
            const { fingerprint } = fingerprintGenerator.getFingerprint({
                locales: ['en', 'es', 'en-US'],
            });

            expect(typeof fingerprint).toBe('object');
        }
    });

    test('Generates fingerprints with correct languages', () => {
        const { fingerprint } = fingerprintGenerator.getFingerprint({
            locales: ['en', 'de', 'en-GB'],
        });

        const fingerprintLanguages = fingerprint.languages;
        expect(fingerprintLanguages.length).toBe(3);
        expect(fingerprintLanguages.includes('en')).toBeTruthy();
        expect(fingerprintLanguages.includes('de')).toBeTruthy();
        expect(fingerprintLanguages.includes('en-GB')).toBeTruthy();
    });

    test('Generated fingerprint and headers match', () => {
        const { fingerprint, headers } = fingerprintGenerator.getFingerprint({
            locales: ['en', 'de', 'en-GB'],
        });

        const headersUserAgent = 'User-Agent' in headers ? headers['User-Agent'] : headers['user-agent'];
        expect(headersUserAgent === fingerprint['userAgent']).toBeTruthy();
    });
});
