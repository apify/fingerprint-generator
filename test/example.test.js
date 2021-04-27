const FingerprintGenerator = require('../src/main');

describe('Basic test', () => {
    const fingerprintGenerator = new FingerprintGenerator();

    const headers = {
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'sec-fetch-site': 'same-site',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-user': '?1',
      'sec-fetch-dest': 'document',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'en-US'
    };

    test('should pass', () => {
        console.log(fingerprintGenerator.getFingerprint(headers));
        expect(true).toBeTruthy();
    });
});
