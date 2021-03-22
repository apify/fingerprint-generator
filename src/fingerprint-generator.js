const fs = require('fs');
const path = require('path');
const parse = require('csv-parse/lib/sync');

const datasetPath = path.join(__dirname, "./dataset.csv");

function getRandomInteger(minimum, maximum) {
    return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

/**
 * Fingerprint generator - randomly generates realistic browser fingerprints
 */
class FingerprintGenerator {

    constructor() {
        const datasetText = fs.readFileSync(datasetPath, {encoding:'utf8'}).replace(/^\ufeff/, '');
        const records = parse(datasetText, {
            columns: true,
            skip_empty_lines: true
        });
        
        this.fingerprints = {};
        for(const record of records) {
            let userAgent = record["browserFingerprint/userAgent"];
            let fingerprint = {};
            for(const datasetAttribute of Object.keys(record)) {
                const attribute = datasetAttribute.replace("www.", "browserFingerprint/");
                if(record[datasetAttribute] !== "")
                    fingerprint[attribute] = record[datasetAttribute];
            }
            if(!(userAgent in this.fingerprints)) {
                this.fingerprints[userAgent] = [];
            }

            this.fingerprints[userAgent].push(fingerprint);
        }
    }

    /**
     * Generates a browser fingerprint consistent with the provided request headers
     * @param {Object} requestHeaders - headers
     */
    getFingerprint(requestHeaders) {
        let userAgent = requestHeaders["user-agent"];
        if(!userAgent) {
            userAgent = requestHeaders["User-Agent"];
        }

        if(!userAgent || !(userAgent in this.fingerprints)) {
            throw new Error('No fingerprint can be generated for these headers.');
        }

        const fingerprintCandidates = this.fingerprints[userAgent];

        return fingerprintCandidates[getRandomInteger(0, fingerprintCandidates.length - 1)];
    }
}

module.exports = FingerprintGenerator;
