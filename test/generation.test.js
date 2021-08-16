const FingerprintGenerator = require('../src/main');
const util = require('util')

describe('Basic test', () => {
    const fingerprintGenerator = new FingerprintGenerator();

    test('should pass', () => {
        for(let x = 0; x < 10000; x++) {
            let fingerprint = fingerprintGenerator.getFingerprint({
                "locales": ["en", "es", "en-US"]
            });
            console.log(util.inspect(fingerprint, {showHidden: false, depth: null}))
        }
        expect(true).toBeTruthy();
    });
});
